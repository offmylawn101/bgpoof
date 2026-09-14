/// <reference lib="webworker" />

import { refineMask } from './refine-mask.js';
import { applyEdgeColors } from './edge-colors.js';

const scope = self as unknown as DedicatedWorkerGlobalScope;
const report = (message: string) =>
  scope.postMessage({ type: 'progress', message });

// Only a compact copy is uploaded. Keep original pixels and alpha for the PNG.
// Transfer the already-decoded bitmap; resizing and encoding run off the UI thread.
scope.onmessage = async ({ data }: MessageEvent<{ bitmap: ImageBitmap }>) => {
  let original: ImageBitmap | undefined;
  let mask: ImageBitmap | undefined;
  let small: OffscreenCanvas | undefined;
  let canvas: OffscreenCanvas | undefined;
  try {
    report('Preparing your photo…');
    original = data.bitmap;
    const { width, height } = original;
    if (width * height > 25_000_000 || width > 8192 || height > 8192)
      throw new Error(
        'Choose a photo up to 25 megapixels and 8,192 pixels per side.',
      );
    const scale = Math.min(1, 1536 / Math.max(width, height));
    small = new OffscreenCanvas(
      Math.max(1, Math.round(width * scale)),
      Math.max(1, Math.round(height * scale)),
    );
    const preview = small.getContext('2d', { willReadFrequently: true });
    if (!preview) throw new Error('Your browser couldn’t prepare this photo.');
    preview.fillStyle = '#fff';
    preview.fillRect(0, 0, small.width, small.height);
    preview.imageSmoothingQuality = 'high';
    preview.drawImage(original, 0, 0, small.width, small.height);
    let upload = await small.convertToBlob({
      type: 'image/jpeg',
      quality: 0.94,
    });
    // Retain more detail while keeping even noisy photos within the API budget.
    if (upload.size > 2 * 1024 * 1024)
      upload = await small.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
    if (upload.size > 2 * 1024 * 1024)
      throw new Error('This photo is too detailed. Try a smaller photo.');
    report('Removing the background…');
    const response = await fetch('/api/remove-background', {
      method: 'POST',
      headers: { 'Content-Type': upload.type },
      body: upload,
      cache: 'no-store',
      credentials: 'omit',
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(
        detail?.error ||
          'The background remover couldn’t finish. Please try again.',
      );
    }
    if (!response.headers.get('Content-Type')?.startsWith('image/png'))
      throw new Error(
        'The background remover returned an invalid result. Please try again.',
      );
    const hasMatting =
      response.headers.get('X-BGPoof-Matte-Format') === 'delta-rgb-v1';
    report('Receiving your cutout…');
    mask = await createImageBitmap(await response.blob());
    if (mask.width !== small.width || mask.height !== small.height)
      throw new Error(
        'The background remover returned an invalid size. Please try again.',
      );
    report('Preparing your preview…');
    const guide = preview.getImageData(0, 0, small.width, small.height);
    preview.clearRect(0, 0, small.width, small.height);
    preview.drawImage(mask, 0, 0);
    const refined = preview.getImageData(0, 0, small.width, small.height);
    if (!hasMatting) refineMask(refined, guide);
    preview.putImageData(refined, 0, 0);
    mask.close();
    mask = await createImageBitmap(small);
    // Reveal a display-sized cutout while the original-resolution PNG encodes.
    // Use original pixels/alpha rather than the inference JPEG's white backing.
    preview.clearRect(0, 0, small.width, small.height);
    preview.drawImage(original, 0, 0, small.width, small.height);
    if (hasMatting) applyEdgeColors(preview, refined);
    preview.globalCompositeOperation = 'destination-in';
    preview.drawImage(mask, 0, 0);
    scope.postMessage({
      type: 'preview',
      blob: await small.convertToBlob({ type: 'image/png' }),
    });
    report('Preparing your full-resolution image…');
    canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context)
      throw new Error(
        'Your browser couldn’t save this photo. Try a smaller photo.',
      );
    context.drawImage(original, 0, 0);
    if (hasMatting) applyEdgeColors(context, refined);
    context.globalCompositeOperation = 'destination-in';
    context.imageSmoothingQuality = 'high';
    context.drawImage(mask, 0, 0, width, height);
    report('Creating your PNG…');
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    scope.postMessage({ type: 'result', blob });
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'TimeoutError'
        ? 'The background remover is taking longer than usual. Please try again.'
        : error instanceof Error && error.name !== 'TypeError'
          ? error.message
          : 'We couldn’t reach the background remover. Check your connection and try again.';
    scope.postMessage({ type: 'error', message });
  } finally {
    original?.close();
    mask?.close();
    if (small) small.width = small.height = 1;
    if (canvas) canvas.width = canvas.height = 1;
  }
};
