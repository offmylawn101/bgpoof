import { test, expect } from '@playwright/test';

// Run the real worker modules, replacing only the provider with an opaque mask.
// Inspect the actual upload Blob; browser interception can omit its body/headers.
test('worker bounds detailed uploads and preserves source transparency', async ({
  page,
}) => {
  await page.goto('/');
  for (const kind of ['noise', 'transparent'] as const) {
    const result = await page.evaluate(async (kind) => {
      const side = kind === 'noise' ? 1536 : 1800;
      const height = kind === 'noise' ? 1536 : 1200;
      const source = new OffscreenCanvas(side, height);
      const ctx = source.getContext('2d')!;
      const pixels = ctx.createImageData(side, height);
      let seed = 123456789;
      for (let i = 0; i < side * height; i++) {
        const x = i % side;
        for (let channel = 0; channel < 3; channel++) {
          seed ^= seed << 13;
          seed ^= seed >>> 17;
          seed ^= seed << 5;
          pixels.data[i * 4 + channel] =
            kind === 'noise' ? seed & 255 : 120 + channel * 40;
        }
        pixels.data[i * 4 + 3] =
          kind === 'noise' ? 255 : x < 600 ? 0 : x < 1200 ? 128 : 255;
      }
      ctx.putImageData(pixels, 0, 0);
      const initialBytes = (
        await source.convertToBlob({ type: 'image/jpeg', quality: 0.94 })
      ).size;
      const bitmap = await createImageBitmap(source);
      const entry = new URL('/removal.worker.mjs', location.href).href;
      const bootstrap = URL.createObjectURL(
        new Blob(
          [
            `
        globalThis.fetch = async (url, options) => {
          if (url !== '/api/remove-background' || options.method !== 'POST')
            throw new Error('Unexpected provider request');
          const image = await createImageBitmap(options.body);
          self.postMessage({ type: 'upload', bytes: options.body.size, width: image.width, height: image.height });
          const mask = new OffscreenCanvas(image.width, image.height);
          const ctx = mask.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, mask.width, mask.height);
          image.close();
          return new Response(await mask.convertToBlob({ type: 'image/png' }), { headers: { 'Content-Type': 'image/png' } });
        };
        await import(${JSON.stringify(entry)});
        self.postMessage({ type: 'ready' });
      `,
          ],
          { type: 'text/javascript' },
        ),
      );
      const worker = new Worker(bootstrap, { type: 'module' });
      const uploads: Array<{ bytes: number; width: number; height: number }> =
        [];
      const started = performance.now();
      const blob = await new Promise<Blob>((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timeout);
          worker.terminate();
          URL.revokeObjectURL(bootstrap);
        };
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error('Photo worker timed out'));
        }, 15000);
        worker.onerror = (event) => {
          cleanup();
          reject(new Error(event.message));
        };
        worker.onmessage = ({ data }) => {
          if (data.type === 'ready') worker.postMessage({ bitmap }, [bitmap]);
          else if (data.type === 'upload')
            uploads.push({
              bytes: data.bytes,
              width: data.width,
              height: data.height,
            });
          else if (data.type === 'result') {
            cleanup();
            resolve(data.blob);
          } else if (data.type === 'error') {
            cleanup();
            reject(new Error(data.message));
          }
        };
      });
      const workerMs = performance.now() - started;
      const output = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(output.width, output.height);
      const resultCtx = canvas.getContext('2d')!;
      resultCtx.drawImage(output, 0, 0);
      const actual = resultCtx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data;
      let alphaMismatches = 0;
      for (let i = 3; i < actual.length; i += 4)
        if (actual[i] !== pixels.data[i]) alphaMismatches++;
      const stats = {
        width: output.width,
        height: output.height,
        alphaMismatches,
        workerMs,
        uploads,
        initialBytes,
      };
      output.close();
      return stats;
    }, kind);
    expect(result).toMatchObject({
      width: kind === 'noise' ? 1536 : 1800,
      height: kind === 'noise' ? 1536 : 1200,
      alphaMismatches: 0,
    });
    expect(result.uploads).toHaveLength(1);
    expect(result.uploads[0]).toMatchObject({
      width: 1536,
      height: kind === 'noise' ? 1536 : 1024,
    });
    expect(result.uploads[0].bytes).toBeGreaterThan(0);
    expect(result.uploads[0].bytes).toBeLessThanOrEqual(2 * 1024 * 1024);
    if (kind === 'noise')
      expect(result.initialBytes).toBeGreaterThan(2 * 1024 * 1024);
    console.log('Worker boundary check:', { kind, ...result });
  }
});
