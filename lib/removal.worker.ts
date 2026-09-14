/// <reference lib="webworker" />
import type * as Ort from 'onnxruntime-common';
let ort: typeof Ort;
const runtime = import(
  /* @vite-ignore */ new URL(
    '/runtime/ort-1.21.0/ort.wasm.min.mjs',
    self.location.origin,
  ).href
);

const scope = self as unknown as DedicatedWorkerGlobalScope;
const MODEL_ROOT = '/models/isnet-fp16-v1/';
const MODEL_BYTES = 88_152_708;
const MODEL_HASH =
  '2eb4b5dda7ec41c617e59706e5aafa1f978c9a5f983d2518d9f0ae4d6eb04f20';
const SIZE = 1024;
let session: Ort.InferenceSession | undefined;

const report = (message: string, value: number | null = null) =>
  scope.postMessage({ type: 'progress', message, value });
const hash = async (data: Uint8Array) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', data as Uint8Array<ArrayBuffer>),
    ),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');

async function loadSession() {
  if (session) return session;
  ort = await runtime;
  ort.env.wasm.wasmPaths = new URL(
    '/runtime/ort-1.21.0/',
    scope.location.origin,
  ).href;
  ort.env.wasm.numThreads = scope.crossOriginIsolated
    ? Math.min(2, navigator.hardwareConcurrency || 1)
    : 1;
  ort.env.wasm.proxy = false;
  report('Downloading the background remover…', 0);
  const response = await fetch(MODEL_ROOT + 'manifest.json');
  if (!response.ok)
    throw new Error(
      'The background remover couldn’t download. Check your connection and try again.',
    );
  const manifest: {
    size: number;
    sha256: string;
    parts: { name: string; size: number; sha256: string }[];
  } = await response.json();
  if (
    manifest.size !== MODEL_BYTES ||
    manifest.sha256 !== MODEL_HASH ||
    manifest.parts.reduce((sum, part) => sum + part.size, 0) !== MODEL_BYTES
  )
    throw new Error(
      'The background remover files need refreshing. Reload this page and try again.',
    );
  const bytes = new Uint8Array(MODEL_BYTES);
  let offset = 0;
  let cache: Cache | undefined;
  try {
    cache = await caches.open('cutout-isnet-fp16-v1');
  } catch {
    /* Storage restrictions must not prevent removal. */
  }
  for (const part of manifest.parts) {
    if (!/^model-\d{2}\.bin$/.test(part.name))
      throw new Error('Invalid background remover file.');
    const url = MODEL_ROOT + part.name;
    let cached: Response | undefined;
    try {
      cached = await cache?.match(url);
    } catch {
      /* Network remains available. */
    }
    let data: Uint8Array | undefined;
    if (cached) {
      const candidate = new Uint8Array(await cached.arrayBuffer());
      if (
        candidate.length === part.size &&
        (await hash(candidate)) === part.sha256
      )
        data = candidate;
      else {
        try {
          await cache?.delete(url);
        } catch {
          /* Best-effort cache. */
        }
      }
    }
    if (!data) {
      const download = await fetch(url);
      if (!download.ok || !download.body)
        throw new Error(
          'The download was interrupted. Check your connection and try again.',
        );
      data = new Uint8Array(part.size);
      const reader = download.body.getReader();
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (received + value.length > part.size) {
          await reader.cancel();
          throw new Error('The download was incomplete. Please try again.');
        }
        data.set(value, received);
        received += value.length;
        const percent = Math.round(((offset + received) / MODEL_BYTES) * 100);
        report(`Downloading the background remover… ${percent}%`, percent);
      }
      if (received !== part.size || (await hash(data)) !== part.sha256)
        throw new Error('The download was incomplete. Please try again.');
      try {
        await cache?.put(
          url,
          new Response(data as Uint8Array<ArrayBuffer>, {
            headers: { 'Content-Type': 'application/octet-stream' },
          }),
        );
      } catch {
        /* Private mode or storage quota: continue without caching. */
      }
    }
    bytes.set(data, offset);
    offset += data.length;
    report(
      'Loading the background remover…',
      Math.round((offset / MODEL_BYTES) * 100),
    );
  }
  if ((await hash(bytes)) !== MODEL_HASH)
    throw new Error('The download was incomplete. Please try again.');
  report('Getting ready for your first photo…');
  session = await ort.InferenceSession.create(bytes, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });
  return session;
}

scope.onmessage = async ({ data }: MessageEvent<{ file: File }>) => {
  let bitmap: ImageBitmap | undefined;
  let input: Ort.Tensor | undefined;
  let outputs: Ort.InferenceSession.OnnxValueMapType | undefined;
  try {
    bitmap = await createImageBitmap(data.file);
    const { width, height } = bitmap;
    if (width * height > 25_000_000 || Math.max(width, height) > 8192)
      throw new Error(
        'Choose a photo up to 25 megapixels, with each side under 8,193 pixels.',
      );
    const model = await loadSession();
    report('Finding your subject…');
    const small = new OffscreenCanvas(SIZE, SIZE);
    const smallContext = small.getContext('2d', { willReadFrequently: true });
    if (!smallContext)
      throw new Error(
        'Your browser couldn’t prepare this photo. Try a different browser.',
      );
    smallContext.drawImage(bitmap, 0, 0, SIZE, SIZE);
    const pixels = smallContext.getImageData(0, 0, SIZE, SIZE).data;
    const area = SIZE * SIZE;
    const normalized = new Float32Array(3 * area);
    for (let i = 0; i < area; i++) {
      normalized[i] = (pixels[i * 4] - 128) / 256;
      normalized[area + i] = (pixels[i * 4 + 1] - 128) / 256;
      normalized[area * 2 + i] = (pixels[i * 4 + 2] - 128) / 256;
    }
    input = new ort.Tensor('float32', normalized, [1, 3, SIZE, SIZE]);
    outputs = await model.run({ input });
    report('Finishing the edges…');
    const alpha = outputs.output.data as Float32Array;
    const mask = smallContext.createImageData(SIZE, SIZE);
    for (let i = 0; i < area; i++) {
      mask.data[i * 4] = 255;
      mask.data[i * 4 + 1] = 255;
      mask.data[i * 4 + 2] = 255;
      mask.data[i * 4 + 3] = Math.round(
        Math.max(0, Math.min(1, alpha[i])) * 255,
      );
    }
    smallContext.putImageData(mask, 0, 0);
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context)
      throw new Error(
        'Your browser couldn’t save this photo. Try a smaller photo.',
      );
    context.drawImage(bitmap, 0, 0);
    context.globalCompositeOperation = 'destination-in';
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(small, 0, 0, width, height);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    canvas.width = canvas.height = 1;
    small.width = small.height = 1;
    scope.postMessage({ type: 'result', blob });
  } catch (error) {
    const message =
      error instanceof Error &&
      /^(Choose|The |Your |Invalid)/.test(error.message)
        ? error.message
        : 'We couldn’t process this photo. Check your connection, close other tabs, or try a smaller JPG, PNG, or WebP.';
    scope.postMessage({ type: 'error', message });
  } finally {
    bitmap?.close();
    input?.dispose();
    if (outputs) for (const output of Object.values(outputs)) output.dispose();
  }
};
