import { test, expect, type Page } from '@playwright/test';
import { deflateSync } from 'node:zlib';

type Pixel = [number, number, number, number];
type Point = [number, number];

// Encode unassociated RGBA bytes directly. A canvas-generated fixture would
// quantize these colors before delivery and hide low-alpha decoding defects.
function png(
  width: number,
  height: number,
  pixel: (x: number, y: number) => Pixel,
): string {
  const crc = (bytes: Buffer) => {
    let value = 0xffffffff;
    for (const byte of bytes) {
      value ^= byte;
      for (let bit = 0; bit < 8; bit++)
        value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
    }
    return (value ^ 0xffffffff) >>> 0;
  };
  const chunk = (name: string, bytes: Buffer) => {
    const body = Buffer.concat([Buffer.from(name), bytes]);
    const length = Buffer.alloc(4);
    const checksum = Buffer.alloc(4);
    length.writeUInt32BE(bytes.length);
    checksum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, checksum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      rows.set(pixel(x, y), y * (width * 4 + 1) + 1 + x * 4);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]).toString('base64');
}

async function remove(
  page: Page,
  source: string,
  provider: string,
  points: Point[],
  format: string | null = 'delta-rgb-v1',
) {
  return page.evaluate(
    async ({ source, provider, points, format }) => {
      const fromBase64 = (value: string) =>
        new Blob(
          [
            Uint8Array.from(atob(value), (character) =>
              character.charCodeAt(0),
            ),
          ],
          { type: 'image/png' },
        );
      const bitmap = await createImageBitmap(fromBase64(source));
      const entry = new URL('/removal.worker.mjs', location.href).href;
      const bootstrap = URL.createObjectURL(
        new Blob(
          [
            `
              globalThis.fetch = async (url, options) => {
                if (url !== '/api/remove-background' || options.method !== 'POST')
                  throw new Error('Unexpected provider request');
                const upload = await createImageBitmap(options.body);
                self.postMessage({ type: 'upload', width: upload.width, height: upload.height });
                upload.close();
                const headers = { 'Content-Type': 'image/png' };
                const format = ${JSON.stringify(format)};
                if (format) headers['X-BGPoof-Matte-Format'] = format;
                const bytes = Uint8Array.from(atob(${JSON.stringify(provider)}), c => c.charCodeAt(0));
                return new Response(bytes, { headers });
              };
              await import(${JSON.stringify(entry)});
              self.postMessage({ type: 'ready' });
            `,
          ],
          { type: 'text/javascript' },
        ),
      );
      const worker = new Worker(bootstrap, { type: 'module' });
      const uploads: Array<{ width: number; height: number }> = [];
      const previews: Blob[] = [];
      const started = performance.now();
      const result = await new Promise<Blob>((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timeout);
          worker.terminate();
          URL.revokeObjectURL(bootstrap);
        };
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error('Photo worker timed out'));
        }, 15_000);
        worker.onerror = ({ message }) => {
          cleanup();
          reject(new Error(message));
        };
        worker.onmessage = ({ data }) => {
          if (data.type === 'ready') worker.postMessage({ bitmap }, [bitmap]);
          else if (data.type === 'upload')
            uploads.push({ width: data.width, height: data.height });
          else if (data.type === 'preview') previews.push(data.blob);
          else if (data.type === 'result') {
            cleanup();
            resolve(data.blob);
          } else if (data.type === 'error') {
            cleanup();
            reject(new Error(data.message));
          }
        };
      });
      const elapsedMs = performance.now() - started;
      const output = await createImageBitmap(result);
      const canvas = new OffscreenCanvas(output.width, output.height);
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      context.drawImage(output, 0, 0);
      const samples = points.map(([x, y]) =>
        Array.from(context.getImageData(x, y, 1, 1).data),
      );
      const previewSizes = [];
      for (const blob of previews) {
        const preview = await createImageBitmap(blob);
        previewSizes.push({ width: preview.width, height: preview.height });
        preview.close();
      }
      const response = {
        width: output.width,
        height: output.height,
        uploads,
        previewSizes,
        samples,
        elapsedMs,
      };
      output.close();
      return response;
    },
    { source, provider, points, format },
  );
}

test.beforeEach(async ({ page }) => {
  await page.route('https://www.googletagmanager.com/**', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: '' }),
  );
  await page.goto('/');
});

test('neutral server RGB preserves colors across the full soft-alpha range', async ({
  page,
}) => {
  const width = 223;
  const source = png(width, 4, (x) => [
    40 + (x % 11) * 13,
    70 + (x % 7) * 11,
    130 + (x % 5) * 8,
    255,
  ]);
  const matte = png(width, 4, (x) => [128, 128, 128, x + 16]);
  const points: Point[] = Array.from({ length: width }, (_, x) => [x, 2]);
  const original = await remove(page, source, matte, points, null);
  const neutral = await remove(page, source, matte, points);
  expect(neutral.samples).toEqual(original.samples);
  expect(neutral.samples.map((pixel) => pixel[3])).toEqual(
    Array.from({ length: width }, (_, x) => x + 16),
  );
});

test('edge corrections clean green and white fringes while protecting original alpha and opaque cores', async ({
  page,
}) => {
  const sourcePixels: Pixel[] = [
    [80, 180, 80, 255],
    [180, 160, 140, 255],
    [90, 70, 50, 255],
    [80, 180, 80, 128],
  ];
  const mattePixels: Pixel[] = [
    [128, 64, 128, 128],
    [88, 88, 88, 128],
    [64, 192, 64, 255],
    [128, 64, 128, 128],
  ];
  const source = png(256, 16, (x) => sourcePixels[Math.floor(x / 64)]);
  const matte = png(256, 16, (x) => mattePixels[Math.floor(x / 64)]);
  const points: Point[] = [
    [32, 8],
    [96, 8],
    [160, 8],
    [224, 8],
  ];
  const legacy = await remove(page, source, matte, points, null);
  const corrected = await remove(page, source, matte, points);
  const expected = [
    [80, 116, 80],
    [140, 120, 100],
  ];
  for (let index = 0; index < expected.length; index++) {
    let before = 0;
    let after = 0;
    for (let channel = 0; channel < 3; channel++) {
      const target = expected[index][channel];
      before += Math.abs(legacy.samples[index][channel] - target);
      after += Math.abs(corrected.samples[index][channel] - target);
      expect(
        Math.abs(corrected.samples[index][channel] - target),
      ).toBeLessThanOrEqual(2);
    }
    expect(after).toBeLessThan(before / 10);
    expect(corrected.samples[index][3]).toBe(128);
  }
  expect(corrected.samples[2]).toEqual([90, 70, 50, 255]);
  expect(corrected.samples[3]).toEqual(legacy.samples[3]);
  expect(corrected.samples[3][3]).toBe(64);
});

test('full-resolution portrait keeps fine source texture while applying compact edge corrections', async ({
  page,
}) => {
  const source = png(1024, 3072, (x) => [x % 2 ? 160 : 80, 170, 90, 255]);
  const matte = png(512, 1536, (x) =>
    x >= 248 && x < 264 ? [128, 96, 128, 128] : [128, 128, 128, 255],
  );
  const result = await remove(page, source, matte, [
    [510, 1536],
    [511, 1536],
    [100, 1536],
    [101, 1536],
  ]);
  expect(result).toMatchObject({
    width: 1024,
    height: 3072,
    uploads: [{ width: 512, height: 1536 }],
    previewSizes: [{ width: 512, height: 1536 }],
  });
  expect(result.samples[1][0] - result.samples[0][0]).toBeGreaterThanOrEqual(
    78,
  );
  for (const pixel of result.samples.slice(0, 2)) {
    expect(Math.abs(pixel[1] - 138)).toBeLessThanOrEqual(2);
    expect(Math.abs(pixel[2] - 90)).toBeLessThanOrEqual(1);
    expect(pixel[3]).toBe(128);
  }
  expect(result.samples[2]).toEqual([80, 170, 90, 255]);
  expect(result.samples[3]).toEqual([160, 170, 90, 255]);
});

test('legacy or unknown provider formats cannot change original photo colors', async ({
  page,
}) => {
  const source = png(32, 8, () => [80, 170, 90, 255]);
  const neutral = png(32, 8, () => [128, 128, 128, 128]);
  const colored = png(32, 8, () => [0, 255, 32, 128]);
  const points: Point[] = [[16, 4]];
  const baseline = await remove(page, source, neutral, points, null);
  for (const format of [null, 'delta-rgb-v2']) {
    const result = await remove(page, source, colored, points, format);
    expect(result.samples).toEqual(baseline.samples);
  }
});
