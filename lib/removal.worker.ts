/// <reference lib="webworker" />

const scope = self as unknown as DedicatedWorkerGlobalScope;
const report = (message: string, value: number | null = null) =>
  scope.postMessage({ type: 'progress', message, value });

// Only a compact copy is uploaded. Keep original pixels and alpha for the PNG.
// Transfer the already-decoded bitmap; resizing and encoding run off the UI thread.
scope.onmessage = async ({ data }: MessageEvent<{ bitmap: ImageBitmap }>) => {
  let original: ImageBitmap | undefined;
  let mask: ImageBitmap | undefined;
  let small: OffscreenCanvas | undefined;
  let canvas: OffscreenCanvas | undefined;
  try {
    report('Preparing your photo…', 10);
    original = data.bitmap;
    const { width, height } = original;
    if (width * height > 25_000_000 || width > 8192 || height > 8192)
      throw new Error(
        'Choose a photo up to 25 megapixels and 8,192 pixels per side.',
      );
    const scale = Math.min(1, 1024 / Math.max(width, height));
    small = new OffscreenCanvas(
      Math.max(1, Math.round(width * scale)),
      Math.max(1, Math.round(height * scale)),
    );
    const preview = small.getContext('2d');
    if (!preview) throw new Error('Your browser couldn’t prepare this photo.');
    preview.fillStyle = '#fff';
    preview.fillRect(0, 0, small.width, small.height);
    preview.imageSmoothingQuality = 'high';
    preview.drawImage(original, 0, 0, small.width, small.height);
    const upload = await small.convertToBlob({
      type: 'image/jpeg',
      quality: 0.94,
    });
    report('Removing the background…', 35);
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
    mask = await createImageBitmap(await response.blob());
    if (mask.width !== small.width || mask.height !== small.height)
      throw new Error(
        'The background remover returned an invalid size. Please try again.',
      );
    report('Saving your full-resolution PNG…', 90);
    // Reveal a display-sized cutout while the original-resolution PNG encodes.
    // Use original pixels/alpha rather than the inference JPEG's white backing.
    preview.clearRect(0, 0, small.width, small.height);
    preview.drawImage(original, 0, 0, small.width, small.height);
    preview.globalCompositeOperation = 'destination-in';
    preview.drawImage(mask, 0, 0);
    scope.postMessage({
      type: 'preview',
      blob: await small.convertToBlob({ type: 'image/png' }),
    });
    canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context)
      throw new Error(
        'Your browser couldn’t save this photo. Try a smaller photo.',
      );
    context.drawImage(original, 0, 0);
    context.globalCompositeOperation = 'destination-in';
    context.imageSmoothingQuality = 'high';
    context.drawImage(mask, 0, 0, width, height);
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
