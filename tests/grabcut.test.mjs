import assert from 'node:assert/strict';
import test from 'node:test';
import { applyGrabCut } from '../edge/grabcut.mjs';

const image = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' });
const baseline = new Uint8Array([5, 6, 7, 8]);
const dimensions = { width: 640, height: 480 };
const secret = 'test-private-service-credential';
function png(width = 640, height = 480) {
  const bytes = new Uint8Array(26);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x89504e47);
  view.setUint32(4, 0x0d0a1a0a);
  view.setUint32(8, 13);
  view.setUint32(12, 0x49484452);
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes[24] = 8;
  bytes[25] = 6;
  return bytes;
}
function env(fetch) {
  return { GRABCUT_SECRET: secret, GRABCUT: { fetch } };
}
const response = () => new Response(baseline);

test('refinement follows segmentation with a framed compact source and mask', async () => {
  let calls = 0;
  const refined = await applyGrabCut(
    image,
    response(),
    env(async (request) => {
      calls++;
      assert.equal(request.url, 'http://bgpoof-grabcut/refine');
      assert.equal(request.method, 'POST');
      assert.equal(request.redirect, 'manual');
      assert.equal(request.headers.get('authorization'), `Bearer ${secret}`);
      assert.equal(
        request.headers.get('content-type'),
        'application/octet-stream',
      );
      const body = new Uint8Array(await request.arrayBuffer());
      assert.equal(Number(request.headers.get('content-length')), body.length);
      assert.equal(new DataView(body.buffer).getUint32(0), image.size);
      assert.deepEqual(
        body.slice(4, 8),
        new Uint8Array(await image.arrayBuffer()),
      );
      assert.deepEqual(body.slice(8), baseline);
      return new Response(png(), {
        headers: { 'Content-Type': 'image/png', 'x-private-header': 'secret' },
      });
    }),
    new AbortController().signal,
    dimensions,
  );
  assert.equal(calls, 1);
  assert.equal(refined.applied, true);
  assert.deepEqual(new Uint8Array(await refined.response.arrayBuffer()), png());
  assert.equal(refined.response.headers.get('x-private-header'), null);
});

test('missing service configuration retains the original streaming response', async () => {
  const original = response();
  const result = await applyGrabCut(
    image,
    original,
    {},
    new AbortController().signal,
    dimensions,
  );
  assert.equal(result.response, original);
  assert.equal(result.applied, false);
});

test('busy, failed and invalid private responses preserve the existing cutout', async () => {
  for (const fetch of [
    async () => new Response('private-image-or-secret', { status: 503 }),
    async () =>
      new Response(null, {
        status: 307,
        headers: { Location: 'https://example.invalid' },
      }),
    async () => {
      throw new Error('private-image-or-secret');
    },
    async () =>
      new Response(png(300, 200), { headers: { 'Content-Type': 'image/png' } }),
    async () =>
      new Response('broken', { headers: { 'Content-Type': 'image/png' } }),
    async () =>
      new Response(png(), { headers: { 'Content-Type': 'text/plain' } }),
  ]) {
    const result = await applyGrabCut(
      image,
      response(),
      env(fetch),
      new AbortController().signal,
      dimensions,
    );
    assert.equal(result.applied, false);
    assert.deepEqual(
      new Uint8Array(await result.response.arrayBuffer()),
      baseline,
    );
  }
});

test('refinement deadline cancels the request and keeps the base result', async () => {
  let requestSignal;
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    const result = await applyGrabCut(
      image,
      response(),
      env((request) => {
        requestSignal = request.signal;
        return new Promise(() => {});
      }),
      new AbortController().signal,
      dimensions,
      15,
    );
    assert.equal(requestSignal.aborted, true);
    assert.equal(result.applied, false);
    assert.deepEqual(
      new Uint8Array(await result.response.arrayBuffer()),
      baseline,
    );
  } finally {
    clearTimeout(keepAlive);
  }
});

test('user cancellation aborts private work instead of delivering a fallback result', async () => {
  const controller = new AbortController();
  let requestSignal;
  const task = applyGrabCut(
    image,
    response(),
    env((request) => {
      requestSignal = request.signal;
      queueMicrotask(() => controller.abort());
      return new Promise(() => {});
    }),
    controller.signal,
    dimensions,
  );
  await assert.rejects(task, { name: 'AbortError' });
  assert.equal(requestSignal.aborted, true);
});

test('oversized or stalled private response bodies are cancelled', async () => {
  let cancelled = false;
  const huge = new ReadableStream({
    pull(controller) {
      controller.enqueue(new Uint8Array(1024 * 1024));
    },
    cancel() {
      cancelled = true;
    },
  });
  const result = await applyGrabCut(
    image,
    response(),
    env(
      async () =>
        new Response(huge, { headers: { 'Content-Type': 'image/png' } }),
    ),
    new AbortController().signal,
    dimensions,
  );
  assert.equal(result.applied, false);
  assert.equal(cancelled, true);

  cancelled = false;
  const slow = new ReadableStream({
    cancel() {
      cancelled = true;
    },
  });
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    const fallback = await applyGrabCut(
      image,
      response(),
      env(
        async () =>
          new Response(slow, { headers: { 'Content-Type': 'image/png' } }),
      ),
      new AbortController().signal,
      dimensions,
      15,
    );
    assert.equal(fallback.applied, false);
    assert.equal(cancelled, true);
  } finally {
    clearTimeout(keepAlive);
  }
});
