import { applyGrabCut } from './grabcut.mjs';

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_SIDE = 1536;
const MAX_PIXELS = 2_400_000;
const FORMATS = new Set(['image/jpeg', 'image/png', 'image/webp']);
const UNAVAILABLE =
  'Background removal is temporarily unavailable. Please try again shortly.';
const BAD_IMAGE =
  'This image could not be read. Try another JPEG, PNG, or WebP image.';

class RequestError extends Error {
  constructor(status, message, headers = {}) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

function checkAbort(signal) {
  if (signal.aborted) throw new RequestError(499, 'The upload was cancelled.');
}

async function withAbort(operation, signal) {
  checkAbort(signal);
  let onAbort;
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(new RequestError(499, 'The upload was cancelled.'));
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    const pending = Promise.resolve().then(() => {
      checkAbort(signal);
      return operation();
    });
    return await Promise.race([pending, aborted]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

async function readImage(request, type) {
  if (!request.body) throw new RequestError(400, 'Choose an image to upload.');
  const reader = request.body.getReader();
  const parts = [];
  let size = 0;
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  request.signal.addEventListener('abort', cancel, { once: true });
  try {
    while (true) {
      checkAbort(request.signal);
      const { done, value } = await reader.read();
      checkAbort(request.signal);
      if (done) break;
      if (!(value instanceof Uint8Array))
        throw new RequestError(400, BAD_IMAGE);
      size += value.byteLength;
      if (size > MAX_BYTES)
        throw new RequestError(413, 'The upload must be 2 MiB or smaller.');
      parts.push(value);
    }
    if (!size) throw new RequestError(400, 'Choose an image to upload.');
    return new Blob(parts, { type });
  } catch (error) {
    cancel();
    checkAbort(request.signal);
    if (error instanceof RequestError) throw error;
    throw new RequestError(
      400,
      'The image upload was interrupted. Please try again.',
    );
  } finally {
    request.signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}

function errorResponse(error, stage) {
  if (!(error instanceof RequestError)) {
    const code = Number(error?.code);
    const status = Number(error?.status);
    if (code === 9422 || code === 9432) {
      error = new RequestError(503, UNAVAILABLE, { 'Retry-After': '60' });
    } else if (code === 429 || status === 429) {
      error = new RequestError(
        429,
        'Too many uploads. Please wait a minute and try again.',
        { 'Retry-After': '60' },
      );
    } else if (
      stage !== 'limit' &&
      (code === 9412 || code === 9413 || [400, 415, 422].includes(status))
    ) {
      error = new RequestError(400, BAD_IMAGE);
    } else {
      // Provider messages may contain input details. Log only the stage and numeric code.
      console.warn('background_removal_unavailable', {
        stage,
        code: Number.isFinite(code) ? code : null,
      });
      error = new RequestError(503, UNAVAILABLE, { 'Retry-After': '60' });
    }
  }
  return Response.json(
    { error: error.message },
    {
      status: error.status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        ...error.headers,
      },
    },
  );
}

/** Called by the Cloudflare HTTP entrypoint for /api/remove-background. */
export async function handleRemoval(request, env) {
  const started = performance.now();
  let stage = 'request';
  try {
    checkAbort(request.signal);
    if (request.method !== 'POST')
      throw new RequestError(405, 'Use POST to upload an image.', {
        Allow: 'POST',
      });
    const origin = new URL(request.url).origin;
    const fetchSite = request.headers.get('sec-fetch-site');
    if (
      request.headers.get('origin') !== origin ||
      (fetchSite && fetchSite !== 'same-origin')
    ) {
      throw new RequestError(403, 'Upload your image from this website.');
    }
    const type = request.headers
      .get('content-type')
      ?.split(';', 1)[0]
      .trim()
      .toLowerCase();
    if (
      !FORMATS.has(type) ||
      ![null, 'identity'].includes(request.headers.get('content-encoding'))
    ) {
      throw new RequestError(415, 'Upload a JPEG, PNG, or WebP image.');
    }
    const length = request.headers.get('content-length');
    if (length !== null) {
      if (!/^\d+$/.test(length))
        throw new RequestError(400, 'The upload size is invalid.');
      if (Number(length) > MAX_BYTES)
        throw new RequestError(413, 'The upload must be 2 MiB or smaller.');
    }

    // This header is supplied by Cloudflare's HTTP ingress. Never use forwarded headers
    // or a caller-selected identifier as a replacement, including in local development.
    const ip = request.headers.get('cf-connecting-ip');
    if (
      !ip ||
      !env?.REMOVAL_LIMITER?.limit ||
      !env?.IMAGES?.info ||
      !env?.IMAGES?.input
    ) {
      throw new RequestError(503, UNAVAILABLE, { 'Retry-After': '60' });
    }
    stage = 'limit';
    const limit = await withAbort(
      () => env.REMOVAL_LIMITER.limit({ key: `remove-background:${ip}` }),
      request.signal,
    );
    if (limit?.success !== true) {
      if (limit?.success === false)
        throw new RequestError(
          429,
          'Too many uploads. Please wait a minute and try again.',
          { 'Retry-After': '60' },
        );
      throw new RequestError(503, UNAVAILABLE, { 'Retry-After': '60' });
    }

    stage = 'upload';
    const image = await readImage(request, type);
    checkAbort(request.signal);
    stage = 'info';
    const info = await withAbort(
      () => env.IMAGES.info(image.stream()),
      request.signal,
    );
    if (
      !info ||
      info.format !== type ||
      !FORMATS.has(info.format) ||
      !Number.isInteger(info.width) ||
      !Number.isInteger(info.height) ||
      info.width < 1 ||
      info.height < 1
    ) {
      throw new RequestError(400, BAD_IMAGE);
    }
    if (
      info.width > MAX_SIDE ||
      info.height > MAX_SIDE ||
      info.width * info.height > MAX_PIXELS
    ) {
      throw new RequestError(
        413,
        'The upload must be at most 1536 pixels on each side and 2.4 megapixels.',
      );
    }

    checkAbort(request.signal);
    stage = 'segment';
    const validated = performance.now();
    // Images has no cancellation argument. Abort stops waiting; an already-started
    // transformation can still finish at the provider. No upload or result is stored.
    const result = await withAbort(
      () =>
        env.IMAGES.input(image.stream())
          .transform({ segment: 'foreground' })
          .output({ format: 'image/png' }),
      request.signal,
    );
    const response = result.response();
    if (!response.ok || !response.body) {
      void response.body?.cancel().catch(() => {});
      throw new RequestError(503, UNAVAILABLE, { 'Retry-After': '60' });
    }
    if (request.signal.aborted) {
      void response.body.cancel().catch(() => {});
      checkAbort(request.signal);
    }
    const segmented = performance.now();
    stage = 'refine';
    const refined = await withAbort(
      () => applyGrabCut(image, response, env, request.signal, info),
      request.signal,
    );
    checkAbort(request.signal);
    return new Response(refined.response.body, {
      headers: {
        'Content-Type': 'image/png',
        'Server-Timing': `validate;dur=${validated - started}, segment;dur=${segmented - validated}, grabcut;dur=${refined.duration}`,
        'X-BGPoof-Refinement': refined.applied ? 'grabcut' : 'cloudflare',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return errorResponse(error, stage);
  } finally {
    if (request.body && !request.body.locked)
      void request.body.cancel().catch(() => {});
  }
}
