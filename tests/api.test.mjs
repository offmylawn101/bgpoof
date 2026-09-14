import assert from 'node:assert/strict';
import test from 'node:test';
import { handleRemoval } from '../edge/removal.mjs';

const ORIGIN = 'https://bgpoof.example';
const INPUT = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const OUTPUT = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);

function request({ headers = {}, body = INPUT, method = 'POST', signal } = {}) {
  const allHeaders = new Headers({
    origin: ORIGIN,
    'content-type': 'image/png',
    'cf-connecting-ip': '203.0.113.7',
    'sec-fetch-site': 'same-origin',
  });
  for (const [name, value] of Object.entries(headers)) {
    if (value === null) allHeaders.delete(name);
    else allHeaders.set(name, value);
  }
  return new Request(`${ORIGIN}/api/remove-background`, {
    method,
    headers: allHeaders,
    body: method === 'GET' ? undefined : body,
    signal,
    ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
  });
}

function bindings({
  metadata = { format: 'image/png', width: 1024, height: 768 },
  limited = false,
  infoError,
  outputError,
  limitError,
  infoHook,
  outputHook,
  outputResponse,
} = {}) {
  const calls = {
    limits: [],
    infos: [],
    inputs: [],
    transforms: [],
    outputs: [],
  };
  return {
    calls,
    REMOVAL_LIMITER: {
      async limit(options) {
        calls.limits.push(options);
        if (limitError) throw limitError;
        return { success: !limited };
      },
    },
    IMAGES: {
      async info(stream) {
        calls.infos.push(
          new Uint8Array(await new Response(stream).arrayBuffer()),
        );
        if (infoError) throw infoError;
        if (infoHook) return infoHook();
        return metadata;
      },
      input(stream) {
        calls.inputs.push(stream);
        return {
          transform(options) {
            calls.transforms.push(options);
            return {
              async output(settings) {
                calls.outputs.push(settings);
                const bytes = new Uint8Array(
                  await new Response(stream).arrayBuffer(),
                );
                assert.deepEqual(bytes, calls.infos[0]);
                if (outputError) throw outputError;
                if (outputHook) return outputHook();
                return {
                  response: () =>
                    outputResponse ??
                    new Response(OUTPUT, {
                      headers: { 'x-private-provider-header': 'hidden' },
                    }),
                };
              },
            };
          },
        };
      },
    },
  };
}

async function expectError(response, status) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  const body = await response.json();
  assert.deepEqual(Object.keys(body), ['error']);
  assert.equal(typeof body.error, 'string');
  assert.ok(!body.error.includes('private-image-or-secret'));
}

test('validated upload returns a transparent PNG and limits by Cloudflare IP', async () => {
  const env = bindings();
  const response = await handleRemoval(
    request({ headers: { 'x-forwarded-for': 'spoofed' } }),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-private-provider-header'), null);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), OUTPUT);
  assert.deepEqual(env.calls.limits, [
    { key: 'remove-background:203.0.113.7' },
  ]);
  assert.deepEqual(env.calls.infos, [INPUT]);
  assert.deepEqual(env.calls.transforms, [{ segment: 'foreground' }]);
  assert.deepEqual(env.calls.outputs, [{ format: 'image/png' }]);
});

test('rejects unsupported methods and cross-origin mutations without calling Images', async () => {
  for (const [options, status] of [
    [{ method: 'GET' }, 405],
    [{ method: 'OPTIONS' }, 405],
    [{ headers: { origin: null } }, 403],
    [{ headers: { origin: 'null' } }, 403],
    [{ headers: { origin: 'https://evil.example' } }, 403],
    [{ headers: { 'sec-fetch-site': 'same-site' } }, 403],
    [{ headers: { 'sec-fetch-site': 'cross-site' } }, 403],
    [{ headers: { 'content-type': 'image/svg+xml' } }, 415],
    [{ headers: { 'content-type': 'image/gif' } }, 415],
    [{ headers: { 'content-encoding': 'gzip' } }, 415],
    [{ headers: { 'content-length': 'banana' } }, 400],
    [{ headers: { 'content-length': String(2 * 1024 * 1024 + 1) } }, 413],
  ]) {
    const env = bindings();
    await expectError(await handleRemoval(request(options), env), status);
    assert.equal(env.calls.infos.length, 0);
    assert.equal(env.calls.inputs.length, 0);
  }
});

test('requires platform IP and both bindings, and fails closed on limiter failure', async () => {
  for (const missing of ['REMOVAL_LIMITER', 'IMAGES']) {
    const env = bindings();
    delete env[missing];
    await expectError(await handleRemoval(request(), env), 503);
    assert.equal(env.calls.inputs.length, 0);
  }
  const env = bindings();
  await expectError(
    await handleRemoval(
      request({
        headers: { 'cf-connecting-ip': null, 'x-forwarded-for': '203.0.113.8' },
      }),
      env,
    ),
    503,
  );
  assert.equal(env.calls.infos.length, 0);
  const broken = bindings({ limitError: new Error('private-image-or-secret') });
  await expectError(await handleRemoval(request(), broken), 503);
  assert.equal(broken.calls.infos.length, 0);
  const malformed = bindings();
  malformed.REMOVAL_LIMITER.limit = async () => ({});
  await expectError(await handleRemoval(request(), malformed), 503);
});

test('rate limit rejection precedes image decoding and inference', async () => {
  const env = bindings({ limited: true });
  const response = await handleRemoval(request(), env);
  assert.equal(response.headers.get('retry-after'), '60');
  await expectError(response, 429);
  assert.equal(env.calls.infos.length, 0);
  assert.equal(env.calls.inputs.length, 0);
});

test('enforces actual streamed bytes despite absent or dishonest content length', async () => {
  for (const length of [null, '8']) {
    let cancelled = false;
    let chunk = 0;
    const body = new ReadableStream({
      pull(controller) {
        controller.enqueue(new Uint8Array(chunk++ ? 1 : 2 * 1024 * 1024));
      },
      cancel() {
        cancelled = true;
      },
    });
    const env = bindings();
    await expectError(
      await handleRemoval(
        request({ body, headers: { 'content-length': length } }),
        env,
      ),
      413,
    );
    assert.equal(cancelled, true);
    assert.equal(env.calls.infos.length, 0);
    assert.equal(env.calls.inputs.length, 0);
  }
});

test('accepts exactly 2MiB, all allowed formats, and the maximum dimensions', async () => {
  for (const format of ['image/jpeg', 'image/png', 'image/webp']) {
    const env = bindings({ metadata: { format, width: 1536, height: 1536 } });
    const response = await handleRemoval(
      request({
        body: new Uint8Array(2 * 1024 * 1024),
        headers: { 'content-type': format },
      }),
      env,
    );
    assert.equal(response.status, 200);
    await response.arrayBuffer();
    assert.equal(env.calls.outputs.length, 1);
  }
});

test('empty, broken, unsupported, malformed, and oversized images never reach inference', async () => {
  const cases = [
    [request({ body: null }), bindings(), 400],
    [request({ body: new Uint8Array() }), bindings(), 400],
    [
      request({
        body: new ReadableStream({
          start(controller) {
            controller.error(new Error('private-image-or-secret'));
          },
        }),
      }),
      bindings(),
      400,
    ],
    [
      request(),
      bindings({
        infoError: { code: 9412, message: 'private-image-or-secret' },
      }),
      400,
    ],
    ...[
      null,
      { format: 'image/svg+xml' },
      { format: 'image/jpeg', width: 100, height: 100 },
      { format: 'image/png', width: 0, height: 100 },
      { format: 'image/png', width: NaN, height: 100 },
    ].map((metadata) => [request(), bindings({ metadata }), 400]),
    [
      request(),
      bindings({ metadata: { format: 'image/png', width: 1537, height: 100 } }),
      413,
    ],
    [
      request(),
      bindings({ metadata: { format: 'image/png', width: 100, height: 1537 } }),
      413,
    ],
  ];
  for (const [req, env, status] of cases) {
    await expectError(await handleRemoval(req, env), status);
    assert.equal(env.calls.inputs.length, 0);
  }
});

test('maps provider quota, rate, invalid-image, and unexpected errors without exposing details', async () => {
  for (const [error, status] of [
    [{ code: 9422 }, 503],
    [{ code: '9422', status: 400 }, 503],
    [{ code: 9432 }, 503],
    [{ status: 429 }, 429],
    [{ code: 9413 }, 400],
    [{ status: 422 }, 400],
    [new Error('private-image-or-secret'), 503],
  ]) {
    error.message = 'private-image-or-secret';
    const env = bindings({ outputError: error });
    await expectError(await handleRemoval(request(), env), status);
  }
  const env = bindings({
    outputResponse: new Response('private-image-or-secret', { status: 500 }),
  });
  await expectError(await handleRemoval(request(), env), 503);
});

test('aborting before or during upload cancels the read and never reaches Images', async () => {
  const before = new AbortController();
  before.abort();
  const env = bindings();
  await expectError(
    await handleRemoval(request({ signal: before.signal }), env),
    499,
  );
  assert.equal(env.calls.limits.length, 0);
  const during = new AbortController();
  let cancelled = false;
  const body = new ReadableStream({
    pull() {
      during.abort();
    },
    cancel() {
      cancelled = true;
    },
  });
  await expectError(
    await handleRemoval(request({ body, signal: during.signal }), env),
    499,
  );
  assert.equal(cancelled, true);
  assert.equal(env.calls.infos.length, 0);
});

test('aborting during metadata validation prevents segmentation', async () => {
  const controller = new AbortController();
  const env = bindings({
    infoHook() {
      controller.abort();
      return new Promise(() => {});
    },
  });
  await expectError(
    await handleRemoval(request({ signal: controller.signal }), env),
    499,
  );
  assert.equal(env.calls.inputs.length, 0);
});

test('an abort during a failing limiter call does not leave an unhandled rejection', async () => {
  const controller = new AbortController();
  const env = bindings();
  env.REMOVAL_LIMITER.limit = () => {
    controller.abort();
    return Promise.reject(new Error('private-image-or-secret'));
  };
  await expectError(
    await handleRemoval(request({ signal: controller.signal }), env),
    499,
  );
  assert.equal(env.calls.infos.length, 0);
});

test('aborting after inference starts stops waiting without starting another transform', async () => {
  const controller = new AbortController();
  const env = bindings({
    outputHook() {
      controller.abort();
      return new Promise(() => {});
    },
  });
  await expectError(
    await handleRemoval(request({ signal: controller.signal }), env),
    499,
  );
  assert.equal(env.calls.outputs.length, 1);
});

test('the public response advertises only a recognized private matte protocol', async () => {
  const mask = new Uint8Array(26);
  const header = new DataView(mask.buffer);
  header.setUint32(0, 0x89504e47);
  header.setUint32(4, 0x0d0a1a0a);
  header.setUint32(8, 13);
  header.setUint32(12, 0x49484452);
  header.setUint32(16, 1024);
  header.setUint32(20, 768);
  mask[24] = 8;
  mask[25] = 6;
  for (const format of ['delta-rgb-v1', 'unsupported']) {
    const env = bindings();
    env.GRABCUT_SECRET = 'test-secret';
    env.GRABCUT = {
      async fetch() {
        return new Response(mask, {
          headers: {
            'Content-Type': 'image/png',
            'X-Bgpoof-Matte-Format': format,
            'X-Private-Header': 'not-for-the-browser',
          },
        });
      },
    };
    const response = await handleRemoval(request(), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-bgpoof-refinement'), 'grabcut');
    assert.equal(
      response.headers.get('x-bgpoof-matte-format'),
      format === 'delta-rgb-v1' ? format : null,
    );
    assert.equal(response.headers.get('x-private-header'), null);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), mask);
  }
});
