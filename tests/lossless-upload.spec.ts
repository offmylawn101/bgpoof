import { test, expect } from '@playwright/test';

type Upload = {
  type: string;
  contentType: string | null;
  bytes: number;
  width: number;
  height: number;
  hash: string;
};

declare global {
  interface Window {
    losslessUploads: Upload[];
  }
}

test.use({ serviceWorkers: 'block' });

for (const kind of ['sharp', 'oversized', 'large'] as const) {
  test(
    kind === 'sharp'
      ? 'app sends an eligible PNG byte-for-byte to background removal'
      : `app bounds a ${kind === 'oversized' ? 'PNG above 2 MiB' : 'PNG above 1536 pixels'} with JPEG fallback`,
    async ({ page, context }) => {
      await page.addInitScript(() => {
        window.losslessUploads = [];
        const channel = new BroadcastChannel('bgpoof-lossless-test');
        channel.onmessage = ({ data }) => window.losslessUploads.push(data);
      });
      await context.route('**/removal.worker.mjs', async (route) => {
        const response = await route.fetch();
        // Exercise the real app-to-worker handoff and upload construction.
        // Inspect the Blob inside the worker because browser request events
        // can omit Blob bodies; only the provider response is substituted.
        await route.fulfill({
          response,
          body: `
            globalThis.fetch = async (url, options) => {
              if (url !== '/api/remove-background' || options.method !== 'POST')
                throw new Error('Unexpected provider request');
              const upload = options.body;
              const image = await createImageBitmap(upload);
              const hash = Array.from(new Uint8Array(await crypto.subtle.digest(
                'SHA-256', await upload.arrayBuffer()
              )), byte => byte.toString(16).padStart(2, '0')).join('');
              const channel = new BroadcastChannel('bgpoof-lossless-test');
              channel.postMessage({
                type: upload.type,
                contentType: new Headers(options.headers).get('Content-Type'),
                bytes: upload.size, width: image.width, height: image.height, hash
              });
              channel.close();
              const mask = new OffscreenCanvas(image.width, image.height);
              const context = mask.getContext('2d');
              context.fillStyle = '#fff';
              context.fillRect(0, 0, mask.width, mask.height);
              image.close();
              return new Response(await mask.convertToBlob({ type: 'image/png' }), {
                headers: { 'Content-Type': 'image/png' }
              });
            };
            ${await response.text()}
          `,
        });
      });
      await page.route('https://www.googletagmanager.com/**', (route) =>
        route.fulfill({ contentType: 'text/javascript', body: '' }),
      );
      await page.goto('/');
      const source = await page.evaluate(async (kind) => {
        const width = kind === 'sharp' ? 1254 : kind === 'large' ? 1800 : 1024;
        const height = kind === 'large' ? 1200 : width;
        const canvas = new OffscreenCanvas(width, height);
        const context = canvas.getContext('2d')!;
        if (kind === 'oversized') {
          const pixels = context.createImageData(width, height);
          let seed = 123456789;
          for (let i = 0; i < pixels.data.length; i++) {
            seed ^= seed << 13;
            seed ^= seed >>> 17;
            seed ^= seed << 5;
            pixels.data[i] = i % 4 === 3 ? 255 : seed & 255;
          }
          context.putImageData(pixels, 0, 0);
        } else {
          context.fillStyle = '#fff';
          context.fillRect(0, 0, width, height);
          context.fillStyle = '#000';
          context.beginPath();
          context.moveTo(100, 100);
          context.lineTo(width - 100, height / 2);
          context.lineTo(100, height - 100);
          context.fill();
          context.fillStyle = '#f00';
          context.fillRect(120, 120, 80, 80);
        }
        const blob = await canvas.convertToBlob({ type: 'image/png' });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const hash = Array.from(
          new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
          (byte) => byte.toString(16).padStart(2, '0'),
        ).join('');
        // Chunk the conversion so the large fixture does not exceed argument limits.
        let binary = '';
        for (let i = 0; i < bytes.length; i += 8192)
          binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        return { width, height, bytes: blob.size, hash, base64: btoa(binary) };
      }, kind);
      if (kind === 'oversized')
        expect(source.bytes).toBeGreaterThan(2 * 1024 * 1024);
      else expect(source.bytes).toBeLessThanOrEqual(2 * 1024 * 1024);

      await page.locator('input[type="file"]').setInputFiles({
        name: `${kind}.png`,
        mimeType: 'image/png',
        buffer: Buffer.from(source.base64, 'base64'),
      });
      await expect(
        page.getByRole('link', { name: 'Download PNG' }),
      ).toBeVisible();
      const uploads = await page.evaluate(() => window.losslessUploads);
      expect(uploads).toHaveLength(1);
      const upload = uploads[0];
      expect(upload.bytes).toBeGreaterThan(0);
      expect(upload.bytes).toBeLessThanOrEqual(2 * 1024 * 1024);
      if (kind === 'sharp') {
        expect(upload).toEqual({
          type: 'image/png',
          contentType: 'image/png',
          bytes: source.bytes,
          width: source.width,
          height: source.height,
          hash: source.hash,
        });
      } else {
        expect(upload).toMatchObject({
          type: 'image/jpeg',
          contentType: 'image/jpeg',
          width: kind === 'large' ? 1536 : source.width,
          height: kind === 'large' ? 1024 : source.height,
        });
        expect(upload.hash).not.toBe(source.hash);
      }
      const result = page.getByRole('img', {
        name: 'Your photo with a transparent background',
      });
      await expect(result).toHaveJSProperty('naturalWidth', source.width);
      await expect(result).toHaveJSProperty('naturalHeight', source.height);
    },
  );
}
