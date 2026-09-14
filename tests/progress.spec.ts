import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    progressTest: { channel: BroadcastChannel; waiting: string[] };
  }
}

test.use({ serviceWorkers: 'block' });

test('progress follows actual work and waits for the full-resolution PNG', async ({
  page,
  context,
}, testInfo) => {
  await page.addInitScript(() => {
    const channel = new BroadcastChannel('bgpoof-progress-test');
    window.progressTest = { channel, waiting: [] };
    channel.onmessage = ({ data }) => window.progressTest.waiting.push(data);
  });
  await context.route('**/removal.worker.mjs', async (route) => {
    const response = await route.fetch();
    // Keep the real worker and UI pipeline. Hold only the opaque operations
    // so assertions depend on their completion, not machine or network speed.
    await route.fulfill({
      response,
      body: `
        (() => {
          const channel = new BroadcastChannel('bgpoof-progress-test');
          const gates = new Map();
          const hold = stage => new Promise(resolve => {
            gates.set(stage, resolve);
            channel.postMessage(stage);
          });
          channel.onmessage = ({ data }) => gates.get(data)?.();
          const encode = OffscreenCanvas.prototype.convertToBlob;
          let pngEncodes = 0;
          OffscreenCanvas.prototype.convertToBlob = async function(options) {
            if (options?.type === 'image/png' && ++pngEncodes === 2)
              await hold('encoding');
            return encode.call(this, options);
          };
          globalThis.fetch = async (url, options) => {
            if (url !== '/api/remove-background' || options.method !== 'POST')
              throw new Error('Unexpected provider request');
            await hold('provider');
            const image = await createImageBitmap(options.body);
            const mask = new OffscreenCanvas(image.width, image.height);
            const context = mask.getContext('2d');
            context.fillStyle = '#fff';
            context.fillRect(0, 0, mask.width, mask.height);
            image.close();
            const blob = await encode.call(mask, { type: 'image/png' });
            return new Response(new ReadableStream({
              async start(controller) {
                await hold('response');
                controller.enqueue(new Uint8Array(await blob.arrayBuffer()));
                controller.close();
              }
            }), { headers: { 'Content-Type': 'image/png' } });
          };
        })();
        ${await response.text()}
      `,
    });
  });
  await page.route('https://www.googletagmanager.com/**', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: '' }),
  );
  await page.goto('/');
  await page.clock.install();
  await page.locator('input[type="file"]').setInputFiles('public/example.jpg');

  const bar = page.getByRole('progressbar', {
    name: 'Background removal progress',
  });
  const status = page.locator('#processing-status');
  const download = page.getByRole('link', { name: 'Download PNG' });
  const cutout = page.getByRole('img', {
    name: 'Your photo with a transparent background',
  });
  const waitFor = async (stage: string) => {
    await expect
      .poll(() => page.evaluate(() => window.progressTest.waiting))
      .toContain(stage);
  };
  const release = (stage: string) =>
    page.evaluate(
      (stage) => window.progressTest.channel.postMessage(stage),
      stage,
    );
  const expectPending = async (message: string) => {
    await expect(status).toHaveText(message);
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute('data-indeterminate', '');
    await expect(bar).not.toHaveAttribute('aria-valuenow', /.+/);
    await expect(bar).toHaveAttribute('aria-describedby', 'processing-status');
    await expect(download).toHaveCount(0);
  };

  await waitFor('provider');
  await expectPending('Removing the background…');
  await expect(cutout).toHaveCount(0);
  await page.clock.fastForward(5000);
  await expectPending('Removing the background…');

  await release('provider');
  await waitFor('response');
  await expectPending('Receiving your cutout…');
  await expect(cutout).toHaveCount(0);

  await release('response');
  await waitFor('encoding');
  await expectPending('Creating your PNG…');
  await expect(
    page.getByRole('heading', { name: 'Finishing your PNG.' }),
  ).toBeVisible();
  await expect(cutout).toHaveJSProperty('naturalWidth', 1536);
  const previewUrl = await cutout.getAttribute('src');
  await page.clock.fastForward(5000);
  await expectPending('Creating your PNG…');
  await expect(cutout).toHaveAttribute('src', previewUrl!);
  await page.screenshot({ path: testInfo.outputPath('encoding-pending.png') });

  await release('encoding');
  await expect(download).toBeVisible();
  await expect(bar).toHaveCount(0);
  await expect(status).toHaveCount(0);
  await expect(cutout).toHaveJSProperty('naturalWidth', 1600);
  await expect(cutout).toHaveJSProperty('naturalHeight', 1200);
  await expect(cutout).toHaveAttribute(
    'src',
    (await download.getAttribute('href'))!,
  );
});
