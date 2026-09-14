const MAX_MASK_BYTES = 12 * 1024 * 1024;

async function boundedBlob(response, signal) {
  if (!response.body) throw new Error('Missing mask.');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  const cancel = () => void reader.cancel().catch(() => {});
  signal.addEventListener('abort', cancel, { once: true });
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_MASK_BYTES) throw new Error('Mask exceeds size limit.');
      chunks.push(value);
    }
    if (!size) throw new Error('Empty mask.');
    return new Blob(chunks, { type: 'image/png' });
  } catch (error) {
    cancel();
    throw error;
  } finally {
    signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}

async function withinDeadline(operation, signal) {
  signal.throwIfAborted();
  let abort;
  const cancelled = new Promise((_, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
  });
  try {
    return await Promise.race([operation(), cancelled]);
  } finally {
    signal.removeEventListener('abort', abort);
  }
}

// The private service receives only the compact source and mask, never a public
// image URL. Preserve the Cloudflare result if automatic recovery is unavailable.
export async function applyGrabCut(
  image,
  response,
  env,
  signal,
  dimensions,
  timeoutMs = 5000,
) {
  signal.throwIfAborted();
  if (!env.GRABCUT?.fetch || !env.GRABCUT_SECRET)
    return { response, applied: false, duration: 0 };

  const baseline = await boundedBlob(response, signal);
  const started = performance.now();
  let status = 0;
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
  try {
    const body = await withinDeadline(async () => {
      const prefix = new Uint8Array(4);
      new DataView(prefix.buffer).setUint32(0, image.size);
      const payload = new Blob([prefix, image, baseline]);
      const refined = await env.GRABCUT.fetch(
        new Request('http://bgpoof-grabcut/refine', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.GRABCUT_SECRET}`,
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(payload.size),
          },
          body: payload,
          signal: deadline,
          redirect: 'manual',
        }),
      );
      status = refined.status;
      if (!refined.ok || refined.headers.get('content-type') !== 'image/png') {
        void refined.body?.cancel().catch(() => {});
        throw new Error('Refinement unavailable.');
      }
      const png = await boundedBlob(refined, deadline);
      const header = new Uint8Array(await png.slice(0, 26).arrayBuffer());
      const view = new DataView(header.buffer);
      if (
        header.length < 26 ||
        view.getUint32(0) !== 0x89504e47 ||
        view.getUint32(4) !== 0x0d0a1a0a ||
        view.getUint32(12) !== 0x49484452 ||
        view.getUint32(16) !== dimensions.width ||
        view.getUint32(20) !== dimensions.height ||
        header[24] !== 8 ||
        header[25] !== 6
      )
        throw new Error('Invalid refinement mask.');
      return png;
    }, deadline);
    return {
      response: new Response(body),
      applied: true,
      duration: performance.now() - started,
    };
  } catch {
    signal.throwIfAborted();
    console.warn('grabcut_fallback', { status });
    return {
      response: new Response(baseline),
      applied: false,
      duration: performance.now() - started,
    };
  }
}
