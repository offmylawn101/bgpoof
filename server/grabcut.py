#!/usr/bin/env python3
"""Private, bounded GrabCut refinement service. Images never touch disk."""

from __future__ import annotations

import hmac
import json
import multiprocessing as mp
from multiprocessing.sharedctypes import RawArray
import os
from pathlib import Path
import signal
import socket
import struct
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn

MAX_SOURCE_BYTES = 2 * 1024 * 1024
MAX_BODY_BYTES = 14 * 1024 * 1024
MAX_RESULT_BYTES = 12 * 1024 * 1024
MAX_SIDE = 1536
MAX_PIXELS = 2_400_000
JOB_SECONDS = 4.0
READ_SECONDS = 4.0


class InvalidImage(ValueError):
    pass


def image_header(data: bytes) -> tuple[str, int, int]:
    """Read dimensions before entering a native image decoder."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        if len(data) < 33 or data[8:16] != b"\x00\x00\x00\rIHDR":
            raise InvalidImage("Invalid PNG header")
        width, height = struct.unpack_from(">II", data, 16)
        kind = "png"
    elif data.startswith(b"\xff\xd8"):
        offset = 2
        width = height = 0
        while offset < len(data):
            if data[offset] != 0xFF:
                raise InvalidImage("Invalid JPEG header")
            while offset < len(data) and data[offset] == 0xFF:
                offset += 1
            if offset >= len(data):
                break
            marker = data[offset]
            offset += 1
            if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
                continue
            if marker in (0xD9, 0xDA) or offset + 2 > len(data):
                break
            length = int.from_bytes(data[offset:offset + 2], "big")
            if length < 2 or offset + length > len(data):
                raise InvalidImage("Invalid JPEG segment")
            if marker in (0xC0, 0xC1, 0xC2):
                if length < 8:
                    raise InvalidImage("Invalid JPEG dimensions")
                height, width = struct.unpack_from(">HH", data, offset + 3)
                break
            offset += length
        kind = "jpeg"
    elif data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        if len(data) < 20 or int.from_bytes(data[4:8], "little") + 8 != len(data):
            raise InvalidImage("Invalid WebP container")
        offset = 12
        width = height = 0
        while offset + 8 <= len(data):
            kind_id = data[offset:offset + 4]
            length = int.from_bytes(data[offset + 4:offset + 8], "little")
            payload = offset + 8
            if payload + length > len(data):
                raise InvalidImage("Invalid WebP chunk")
            if kind_id == b"VP8X" and length >= 10:
                if data[payload] & 0x02:
                    raise InvalidImage("Animated images are unsupported")
                width = int.from_bytes(data[payload + 4:payload + 7], "little") + 1
                height = int.from_bytes(data[payload + 7:payload + 10], "little") + 1
                break
            if kind_id == b"VP8 " and length >= 10 and data[payload + 3:payload + 6] == b"\x9d\x01\x2a":
                width = int.from_bytes(data[payload + 6:payload + 8], "little") & 0x3FFF
                height = int.from_bytes(data[payload + 8:payload + 10], "little") & 0x3FFF
                break
            if kind_id == b"VP8L" and length >= 5 and data[payload] == 0x2F:
                bits = int.from_bytes(data[payload + 1:payload + 5], "little")
                width, height = (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
                break
            offset = payload + length + (length & 1)
        kind = "webp"
    else:
        raise InvalidImage("Only JPEG, PNG and WebP images are supported")
    if not width or not height or max(width, height) > MAX_SIDE or width * height > MAX_PIXELS:
        raise InvalidImage("Image dimensions exceed the working-image limit")
    return kind, width, height


def unpack_images(body: bytes) -> tuple[bytes, bytes, tuple[int, int]]:
    if len(body) < 5 or len(body) > MAX_BODY_BYTES:
        raise InvalidImage("Invalid request size")
    source_size = int.from_bytes(body[:4], "big")
    if source_size < 1 or source_size > MAX_SOURCE_BYTES or source_size + 4 >= len(body):
        raise InvalidImage("Invalid source image size")
    source, cutout = body[4:source_size + 4], body[source_size + 4:]
    _, width, height = image_header(source)
    kind, mask_width, mask_height = image_header(cutout)
    if kind != "png" or cutout[24:26] != b"\x08\x06":
        raise InvalidImage("Cutout must be an 8-bit RGBA PNG")
    if (width, height) != (mask_width, mask_height):
        raise InvalidImage("Source and cutout dimensions must match")
    return source, cutout, (width, height)


def refine_images(body: bytes) -> tuple[bytes, str]:
    """Runs only in the isolated native process (and direct unit tests)."""
    import cv2 as cv
    import numpy as np

    source_bytes, cutout_bytes, dimensions = unpack_images(body)
    source = cv.imdecode(np.frombuffer(source_bytes, np.uint8), cv.IMREAD_UNCHANGED)
    cutout = cv.imdecode(np.frombuffer(cutout_bytes, np.uint8), cv.IMREAD_UNCHANGED)
    width, height = dimensions
    if source is None or cutout is None or source.shape[:2] != (height, width):
        raise InvalidImage("Image could not be decoded")
    if cutout.shape != (height, width, 4) or cutout.dtype != np.uint8:
        raise InvalidImage("Cutout must contain an 8-bit alpha channel")
    if source.dtype == np.uint16:
        source = (source >> 8).astype(np.uint8)
    if source.dtype != np.uint8:
        raise InvalidImage("Unsupported source pixel format")
    if source.ndim == 2:
        source = cv.cvtColor(source, cv.COLOR_GRAY2BGR)
    elif source.shape[2] == 4:
        source = cv.cvtColor(source, cv.COLOR_BGRA2BGR)
    elif source.shape[2] != 3:
        raise InvalidImage("Unsupported source channels")

    scale = min(1.0, 512 / max(width, height))
    small_size = (max(1, round(width * scale)), max(1, round(height * scale)))
    small_image = cv.resize(source, small_size, interpolation=cv.INTER_AREA)
    baseline = cutout[:, :, 3]
    small_alpha = cv.resize(baseline, small_size, interpolation=cv.INTER_LINEAR)
    labels = np.full(small_alpha.shape, cv.GC_PR_FGD, np.uint8)
    labels[small_alpha >= 239] = cv.GC_FGD
    border = np.zeros(small_alpha.shape, dtype=bool)
    border[0, :] = border[-1, :] = True
    border[:, 0] = border[:, -1] = True
    background = border & (small_alpha < 16)
    labels[background] = cv.GC_BGD

    status = "unchanged"
    alpha = baseline
    # GrabCut needs samples for both mixtures. Do not invent foreground when
    # Cloudflare found none or force an image-touching subject into background.
    if np.count_nonzero(background) >= 5 and np.count_nonzero(labels == cv.GC_FGD) >= 5:
        cv.setRNGSeed(1)
        cv.grabCut(small_image, labels, None, np.zeros((1, 65), np.float64),
                   np.zeros((1, 65), np.float64), 1, cv.GC_INIT_WITH_MASK)
        recovered = np.where((labels == cv.GC_FGD) | (labels == cv.GC_PR_FGD), 255, 0).astype(np.uint8)
        recovered = cv.resize(recovered, (width, height), interpolation=cv.INTER_LINEAR)
        alpha = np.maximum(baseline, recovered)
        status = "recovered" if np.any(alpha > baseline) else "unchanged"

    # The caller consumes only alpha. Constant RGB keeps the private response
    # small; it never replaces the original photo's color channels.
    output = np.full((height, width, 4), 255, np.uint8)
    output[:, :, 3] = alpha
    encoded, png = cv.imencode(".png", output, [cv.IMWRITE_PNG_COMPRESSION, 1])
    if not encoded or png.nbytes > MAX_RESULT_BYTES:
        raise RuntimeError("Unable to encode refinement")
    return png.tobytes(), status


def native_worker(connection, incoming, outgoing):
    # Prevent native libraries from competing with unrelated services.
    os.environ["OPENBLAS_NUM_THREADS"] = "1"
    os.environ["OMP_NUM_THREADS"] = "1"
    os.environ["MKL_NUM_THREADS"] = "1"
    import resource
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    resource.setrlimit(resource.RLIMIT_AS, (1024 ** 3, 1024 ** 3))
    import cv2 as cv
    cv.setNumThreads(1)
    connection.send(("ready",))
    try:
        while True:
            length = connection.recv()
            started = time.monotonic()
            try:
                png, status = refine_images(bytes(memoryview(incoming).cast("B")[:length]))
                memoryview(outgoing).cast("B")[:len(png)] = png
                connection.send(("ok", len(png), status, (time.monotonic() - started) * 1000))
            except InvalidImage:
                connection.send(("invalid",))
            except Exception:
                connection.send(("failed",))
            finally:
                png = None
    except (EOFError, BrokenPipeError):
        pass
    finally:
        connection.close()


class NativeProcessor:
    """One warm process, fixed shared buffers, no native work on HTTP threads."""

    def __init__(self, *, target=native_worker, timeout=JOB_SECONDS):
        self.context = mp.get_context("spawn")
        self.incoming = RawArray("B", MAX_BODY_BYTES)
        self.outgoing = RawArray("B", MAX_RESULT_BYTES)
        self.target = target
        self.timeout = timeout
        self.process = None
        self.connection = None

    def start(self, deadline):
        # Spawn imports the entrypoint before running native_worker. Set thread
        # limits first, including when a test entrypoint imports NumPy itself.
        for variable in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "MKL_NUM_THREADS"):
            os.environ[variable] = "1"
        self.connection, child = self.context.Pipe()
        self.process = self.context.Process(target=self.target, args=(child, self.incoming, self.outgoing), daemon=True)
        self.process.start()
        child.close()
        if not self.connection.poll(max(0, deadline - time.monotonic())) or self.connection.recv() != ("ready",):
            self.close()
            raise TimeoutError("Refinement worker startup timed out")

    def run(self, body):
        deadline = time.monotonic() + self.timeout
        try:
            if self.process is None or not self.process.is_alive():
                self.close()
                self.start(deadline)
            memoryview(self.incoming).cast("B")[:len(body)] = body
            self.connection.send(len(body))
            if not self.connection.poll(max(0, deadline - time.monotonic())):
                raise TimeoutError("Refinement timed out")
            message = self.connection.recv()
            if message[0] == "invalid":
                raise InvalidImage("Image could not be processed")
            if message[0] != "ok":
                raise RuntimeError("Refinement failed")
            _, length, status, processing_ms = message
            return bytes(memoryview(self.outgoing).cast("B")[:length]), status, processing_ms
        except (TimeoutError, EOFError, BrokenPipeError):
            self.close()
            raise TimeoutError("Refinement worker unavailable") from None
        finally:
            # No image retention between requests, including failed jobs.
            memoryview(self.incoming).cast("B")[:] = b"\0" * MAX_BODY_BYTES
            memoryview(self.outgoing).cast("B")[:] = b"\0" * MAX_RESULT_BYTES

    def close(self):
        if self.process is not None:
            if self.process.is_alive():
                self.process.terminate()
                self.process.join(0.25)
                if self.process.is_alive():
                    self.process.kill()
                    self.process.join(0.25)
            self.process.close()
            self.process = None
        if self.connection is not None:
            self.connection.close()
            self.connection = None


class RefinementServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    block_on_close = False
    request_queue_size = 4

    def __init__(self, address, secret, processor):
        self.secret = "Bearer " + secret
        self.processor = processor
        self.job_slot = threading.BoundedSemaphore(1)
        self.connection_slots = threading.BoundedSemaphore(4)
        super().__init__(address, RefinementHandler)

    def get_request(self):
        connection, address = super().get_request()
        connection.settimeout(READ_SECONDS)
        return connection, address

    def process_request(self, request, client_address):
        if not self.connection_slots.acquire(blocking=False):
            request.close()
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self.connection_slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.connection_slots.release()

    def handle_error(self, request, client_address):
        # Never log request contents, source addresses or native tracebacks.
        pass


class RefinementHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.0"
    server_version = "BGPoof"
    sys_version = ""

    def log_message(self, format, *args):
        pass

    def reply(self, status, data, content_type="application/json", headers=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        try:
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError, TimeoutError):
            pass

    def error(self, status, message):
        self.reply(status, json.dumps({"error": message}, separators=(",", ":")).encode())

    def authorized(self):
        tokens = self.headers.get_all("Authorization", [])
        return len(tokens) == 1 and hmac.compare_digest(tokens[0].encode(), self.server.secret.encode())

    def do_GET(self):
        if not self.authorized():
            self.error(401, "Unauthorized")
        elif self.path == "/health":
            self.reply(200, b'{"ok":true}')
        else:
            self.error(404, "Not found")

    def do_POST(self):
        if not self.authorized():
            return self.error(401, "Unauthorized")
        if self.path != "/refine":
            return self.error(404, "Not found")
        if self.headers.get("Content-Type", "").lower() != "application/octet-stream":
            return self.error(415, "Expected application/octet-stream")
        lengths = self.headers.get_all("Content-Length", [])
        if len(lengths) != 1 or not lengths[0].isascii() or not lengths[0].isdigit():
            return self.error(411, "A single Content-Length is required")
        if self.headers.get("Transfer-Encoding") or self.headers.get("Content-Encoding"):
            return self.error(400, "Encoded bodies are unsupported")
        if len(lengths[0]) > len(str(MAX_BODY_BYTES)):
            return self.error(413, "Request exceeds size limit")
        length = int(lengths[0])
        if length < 5 or length > MAX_BODY_BYTES:
            return self.error(413, "Request exceeds size limit")
        if not self.server.job_slot.acquire(blocking=False):
            return self.error(503, "Refinement is busy")
        try:
            deadline = time.monotonic() + READ_SECONDS
            body = bytearray()
            while len(body) < length:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError()
                self.connection.settimeout(remaining)
                part = self.rfile.read1(min(65536, length - len(body)))
                if not part:
                    return self.error(400, "Incomplete request body")
                body.extend(part)
            unpack_images(body)
            self.connection.settimeout(READ_SECONDS)
            png, status, processing_ms = self.server.processor.run(body)
            self.reply(200, png, "image/png", {
                "X-Bgpoof-Refinement": status,
                "Server-Timing": f"grabcut;dur={processing_ms:.1f}",
            })
        except InvalidImage:
            self.error(400, "Invalid working images")
        except (TimeoutError, socket.timeout):
            self.error(504, "Refinement timed out")
        except Exception:
            self.error(503, "Refinement unavailable")
        finally:
            self.server.job_slot.release()


def main():
    secret = Path(os.environ["BGPOOF_SECRET_FILE"]).read_text().strip()
    if len(secret) < 32 or any(character.isspace() for character in secret):
        raise SystemExit("BGPOOF_SECRET_FILE must contain a token of at least 32 characters")
    processor = NativeProcessor()
    def stop(signum, frame):
        raise KeyboardInterrupt()
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        processor.start(time.monotonic() + 10)
        server = RefinementServer(("127.0.0.1", 5137), secret, processor)
        print("BGPoof refinement listening on 127.0.0.1:5137", flush=True)
        try:
            server.serve_forever(poll_interval=0.25)
        finally:
            server.server_close()
    except KeyboardInterrupt:
        pass
    finally:
        processor.close()


if __name__ == "__main__":
    main()
