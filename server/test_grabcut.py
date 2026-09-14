"""Run with the server venv: python -m unittest discover -s server -v."""

import http.client
import os
import socket
import struct
import threading
import time
import unittest

import cv2 as cv
import numpy as np

from grabcut import (InvalidImage, MATTE_FORMAT, MAX_BODY_BYTES, MAX_SIDE, NativeProcessor,
                     RefinementServer, edge_matte, image_header, native_worker, refine_images, unpack_images)


def encode(image, extension=".png"):
    success, result = cv.imencode(extension, image)
    assert success
    return result.tobytes()


def envelope(source, cutout):
    return struct.pack(">I", len(source)) + source + cutout


def fixture(alpha=None):
    image = np.full((48, 64, 3), (185, 40, 20), np.uint8)
    image[10:38, 16:48] = (15, 60, 220)
    if alpha is None:
        alpha = np.zeros((48, 64), np.uint8)
        alpha[16:32, 22:42] = 255
    cutout = np.dstack((image, alpha))
    return envelope(encode(image), encode(cutout)), alpha


def hung_worker(connection, incoming, outgoing):
    connection.send(("ready",))
    connection.recv()
    time.sleep(30)


class NativeTests(unittest.TestCase):
    def test_header_formats(self):
        image = np.zeros((21, 37, 3), np.uint8)
        for extension, kind in ((".png", "png"), (".jpg", "jpeg"), (".webp", "webp")):
            with self.subTest(kind=kind):
                self.assertEqual(image_header(encode(image, extension)), (kind, 37, 21))

    def test_rejects_oversized_dimensions_before_decode(self):
        payload = bytearray(encode(np.zeros((8, 8, 3), np.uint8)))
        payload[16:20] = struct.pack(">I", MAX_SIDE + 1)
        with self.assertRaises(InvalidImage):
            image_header(payload)

    def test_rejects_mismatch_and_absent_alpha(self):
        image = np.zeros((8, 8, 3), np.uint8)
        source = encode(image)
        for cutout in (source, encode(np.zeros((9, 8, 4), np.uint8))):
            with self.assertRaises(InvalidImage):
                unpack_images(envelope(source, cutout))

    def test_rejects_invalid_envelope_and_truncated_images(self):
        for body in (b"", b"\0\0\0\0hello", b"\xff\xff\xff\xffhello", b"\0\0\0\x02xxinvalid"):
            with self.assertRaises(InvalidImage):
                unpack_images(body)

    def test_recovers_connected_object_preserving_baseline(self):
        body, baseline = fixture()
        png, status = refine_images(body)
        result = cv.imdecode(np.frombuffer(png, np.uint8), cv.IMREAD_UNCHANGED)
        alpha = result[:, :, 3]
        self.assertEqual(result.shape, (48, 64, 4))
        self.assertTrue(np.all(alpha >= baseline))
        self.assertGreater(int(alpha[11, 17]), 127)
        self.assertEqual(int(alpha[0, 0]), 0)
        self.assertEqual(status, "recovered")

    def test_empty_and_opaque_masks_remain_unchanged(self):
        for value in (0, 255):
            body, baseline = fixture(np.full((48, 64), value, np.uint8))
            png, status = refine_images(body)
            result = cv.imdecode(np.frombuffer(png, np.uint8), cv.IMREAD_UNCHANGED)
            np.testing.assert_array_equal(result[:, :, 3], baseline)
            self.assertTrue(np.all(result[:, :, :3] == 128))
            self.assertEqual(status, "unchanged")

    def test_matting_recovers_soft_edges_and_removes_color_spill(self):
        y, x = np.mgrid[:256, :320]
        boundary = 140 + 20 * np.sin(y / 9) + 6 * np.sin(y / 2)
        truth = np.clip((boundary - x + 3) / 6, 0, 1).astype(np.float32)
        foreground = np.full((256, 320, 3), (35, 80, 210), np.float32)
        background = np.full_like(foreground, (210, 185, 50))
        source = np.round(truth[:, :, None] * foreground +
                          (1 - truth[:, :, None]) * background).astype(np.uint8)
        baseline = np.round(cv.GaussianBlur(truth, (9, 9), 1.5) * 255).astype(np.uint8)
        matte, delta = edge_matte(source, baseline)
        uncertain = (truth > 0.01) & (truth < 0.99)
        before = np.mean(np.abs(baseline[uncertain] / 255 - truth[uncertain]))
        after = np.mean(np.abs(matte[uncertain] / 255 - truth[uncertain]))
        self.assertLess(after, before / 4)
        corrected = np.clip(source.astype(np.int16) + delta, 0, 255)
        before_color = np.mean(np.abs(source[uncertain].astype(np.float32) - foreground[uncertain]))
        after_color = np.mean(np.abs(corrected[uncertain] - foreground[uncertain]))
        self.assertLess(after_color, before_color * 0.6)
        self.assertLessEqual(np.max(np.abs(delta)), 64)
        # A correct matte must retain the untouched object's opaque colors.
        opaque_core = cv.erode((baseline >= 239).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
        np.testing.assert_array_equal(matte[opaque_core], baseline[opaque_core])
        self.assertFalse(np.any(delta[opaque_core]))

    def test_matting_requires_local_color_and_mask_evidence(self):
        alpha = np.zeros((48, 64), np.uint8)
        alpha[:, :28] = 255
        alpha[:, 28:36] = 128
        # Near-identical foreground/background is underdetermined; a third
        # edge color that does not fit the F/B line is also unsafe to solve.
        for mismatch in (False, True):
            source = np.full((48, 64, 3), 120, np.uint8)
            if mismatch:
                source[:, :28] = (30, 30, 200)
                source[:, 36:] = (200, 30, 30)
                source[:, 28:36] = (30, 200, 30)
            matte, delta = edge_matte(source, alpha)
            np.testing.assert_array_equal(matte, alpha)
            self.assertFalse(np.any(delta))
        for value in (0, 128, 255):
            baseline = np.full((48, 64), value, np.uint8)
            matte, delta = edge_matte(source, baseline)
            np.testing.assert_array_equal(matte, baseline)
            self.assertFalse(np.any(delta))

    def test_grabcut_preserves_interior_translucency(self):
        image = np.full((96, 96, 3), (200, 50, 20), np.uint8)
        image[10:86, 10:86] = (20, 70, 210)
        baseline = np.zeros((96, 96), np.uint8)
        baseline[10:86, 10:86] = 255
        baseline[36:60, 36:60] = 100
        baseline[24:26, 36:60] = 100
        png, _ = refine_images(envelope(encode(image), encode(np.dstack((image, baseline)))))
        result = cv.imdecode(np.frombuffer(png, np.uint8), cv.IMREAD_UNCHANGED)
        np.testing.assert_array_equal(result[36:60, 36:60, 3], baseline[36:60, 36:60])
        self.assertTrue(np.all(result[36:60, 36:60, :3] == 128))
        self.assertTrue(np.all(result[24:26, 36:60, 3] == 255))

    def test_native_worker_reuse_and_memory_clear(self):
        processor = NativeProcessor()
        try:
            processor.start(time.monotonic() + 10)
            pid = processor.process.pid
            body, _ = fixture()
            for _ in range(2):
                png, status, milliseconds = processor.run(body)
                self.assertTrue(png.startswith(b"\x89PNG"))
                self.assertEqual(status, "recovered")
                self.assertGreater(milliseconds, 0)
                self.assertEqual(processor.process.pid, pid)
            self.assertFalse(any(processor.incoming))
            self.assertFalse(any(processor.outgoing))
        finally:
            processor.close()

    def test_hard_timeout_kills_native_process(self):
        processor = NativeProcessor(target=hung_worker, timeout=0.15)
        try:
            processor.start(time.monotonic() + 10)
            pid = processor.process.pid
            started = time.monotonic()
            with self.assertRaises(TimeoutError):
                processor.run(b"a")
            self.assertLess(time.monotonic() - started, 0.8)
            self.assertIsNone(processor.process)
            with self.assertRaises(ProcessLookupError):
                os.kill(pid, 0)
            self.assertFalse(any(processor.incoming))
            processor.target = native_worker
            processor.timeout = 4
            self.assertTrue(processor.run(fixture()[0])[0].startswith(b"\x89PNG"))
        finally:
            processor.close()


class FakeProcessor:
    def run(self, body):
        return b"PNG", "recovered", 123.4


class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = RefinementServer(("127.0.0.1", 0), "x" * 32, FakeProcessor())
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, method, path, body=None, headers=None):
        connection = http.client.HTTPConnection(*self.server.server_address, timeout=5)
        connection.request(method, path, body=body, headers=headers or {})
        response = connection.getresponse()
        result = response.status, dict(response.getheaders()), response.read()
        connection.close()
        return result

    def headers(self, **extra):
        return {"Authorization": "Bearer " + "x" * 32, "Content-Type": "application/octet-stream", **extra}

    def test_health_requires_authentication(self):
        self.assertEqual(self.request("GET", "/health")[0], 401)
        status, headers, body = self.request("GET", "/health", headers=self.headers())
        self.assertEqual((status, body), (200, b'{"ok":true}'))
        self.assertEqual(headers["Cache-Control"], "no-store")

    def test_refine_contract(self):
        status, headers, body = self.request("POST", "/refine", fixture()[0], self.headers())
        self.assertEqual((status, body), (200, b"PNG"))
        self.assertEqual(headers["Content-Type"], "image/png")
        self.assertEqual(headers["X-Bgpoof-Refinement"], "recovered")
        self.assertEqual(headers["X-Bgpoof-Matte-Format"], MATTE_FORMAT)
        self.assertEqual(headers["Server-Timing"], "grabcut;dur=123.4")

    def test_rejects_bad_auth_type_and_images(self):
        self.assertEqual(self.request("POST", "/refine", b"hello")[0], 401)
        self.assertEqual(self.request("POST", "/refine", b"hello", self.headers(**{"Content-Type": "image/png"}))[0], 415)
        self.assertEqual(self.request("POST", "/refine", b"hello", self.headers())[0], 400)

    def test_rejects_oversized_or_encoded_body_before_reading(self):
        headers = self.headers(**{"Content-Length": str(MAX_BODY_BYTES + 1)})
        self.assertEqual(self.request("POST", "/refine", headers=headers)[0], 413)
        headers = self.headers(**{"Content-Encoding": "gzip"})
        self.assertEqual(self.request("POST", "/refine", b"hello", headers)[0], 400)

    def test_busy_fails_without_queueing(self):
        self.server.job_slot.acquire()
        try:
            started = time.monotonic()
            self.assertEqual(self.request("POST", "/refine", fixture()[0], self.headers())[0], 503)
            self.assertLess(time.monotonic() - started, 0.25)
        finally:
            self.server.job_slot.release()

    def test_slow_body_times_out_and_releases_slot(self):
        with socket.create_connection(self.server.server_address, timeout=6) as connection:
            connection.sendall(("POST /refine HTTP/1.0\r\nAuthorization: Bearer " + "x" * 32 +
                                "\r\nContent-Type: application/octet-stream\r\nContent-Length: 100\r\n\r\na").encode())
            response = connection.recv(4096)
            self.assertIn(b"504", response.split(b"\r\n")[0])
        self.assertTrue(self.server.job_slot.acquire(timeout=0.5))
        self.server.job_slot.release()


if __name__ == "__main__":
    unittest.main()
