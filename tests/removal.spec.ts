import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

const fixture = 'public/example.jpg';
async function finished(page: import('@playwright/test').Page) {
  await expect(page.getByRole('link', { name: 'Download PNG' })).toBeVisible({
    timeout: 120_000,
  });
  await expect(page.locator('.photo-comparison')).not.toHaveClass(/revealing/, {
    timeout: 5000,
  });
}
async function pngStats(page: import('@playwright/test').Page) {
  const url = await page
    .getByRole('link', { name: 'Download PNG' })
    .getAttribute('href');
  return page.evaluate(async (url) => {
    const blob = await (await fetch(url!)).blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0,
      opaque = 0,
      soft = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 10) transparent++;
      else if (data[i] > 245) opaque++;
      else soft++;
    }
    const result = {
      width: bitmap.width,
      height: bitmap.height,
      type: blob.type,
      transparent: transparent / (data.length / 4),
      opaque: opaque / (data.length / 4),
      soft,
      corner: data[3],
      center:
        data[
          (Math.floor(canvas.height / 3) * canvas.width +
            Math.floor(canvas.width / 2)) *
            4 +
            3
        ],
    };
    bitmap.close();
    return result;
  }, url);
}

test('real upload, wipe, comparison, PNG, repeat drop, clipboard, and privacy', async ({
  page,
  context,
}, testInfo) => {
  const requests: string[] = [],
    errors: string[] = [];
  const performanceBeacons: number[] = [];
  page.on('request', (r) => {
    if (['GET', 'HEAD'].includes(r.method())) return;
    const url = new URL(r.url());
    const body = r.postData() || '';
    if (
      r.method() === 'POST' &&
      url.origin ===
        new URL(process.env.BASE_URL || 'http://localhost:3090').origin &&
      url.pathname === '/cdn-cgi/rum' &&
      body.length < 32768 &&
      !/data:image|iVBORw0KGgo|\/9j\//.test(body)
    ) {
      performanceBeacons.push(body.length);
      return;
    }
    requests.push(`${r.method()} ${r.url()}`);
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.site-shell')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await expect(
    page.getByRole('heading', { name: 'Remove the background.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Upload image' }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('desktop-home.png'),
    fullPage: true,
  });
  await page.evaluate(() => {
    const timings: number[] = [];
    let last = performance.now();
    const interval = setInterval(() => {
      const now = performance.now();
      timings.push(now - last);
      last = now;
    }, 50);
    Object.assign(window, { cutoutTimings: timings, cutoutInterval: interval });
  });
  const started = Date.now();
  await page.getByLabel('Upload photo', { exact: true }).setInputFiles(fixture);
  await finished(page);
  const firstMs = Date.now() - started;
  const stats = await pngStats(page);
  expect(stats).toMatchObject({
    width: 1600,
    height: 1200,
    type: 'image/png',
    corner: 0,
  });
  expect(stats.transparent).toBeGreaterThan(0.5);
  expect(stats.opaque).toBeGreaterThan(0.1);
  expect(stats.opaque).toBeLessThan(0.6);
  expect(stats.soft).toBeGreaterThan(500);
  expect(stats.center).toBeGreaterThan(245);
  const slider = page.getByRole('slider');
  await expect(slider).toHaveAttribute('aria-valuenow', '0');
  await slider.focus();
  await page.keyboard.press('End');
  await expect(slider).toHaveAttribute('aria-valuenow', '100');
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuenow', '1');
  await page.getByRole('button', { name: 'Show original' }).click();
  await expect(slider).toHaveAttribute('aria-valuenow', '100');
  await page.getByRole('button', { name: 'Show cutout' }).click();
  await expect(slider).toHaveAttribute('aria-valuenow', '0');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download PNG' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('example-no-bg.png');
  await download.saveAs(testInfo.outputPath('dog-cutout.png'));
  await page.screenshot({
    path: testInfo.outputPath('desktop-result.png'),
    fullPage: true,
  });
  const timings = await page.evaluate(() => {
    const state = window as Window & {
      cutoutTimings?: number[];
      cutoutInterval?: number;
    };
    clearInterval(state.cutoutInterval);
    return state.cutoutTimings!;
  });
  expect(timings.length).toBeGreaterThan(20);
  expect(Math.max(...timings)).toBeLessThan(1500);

  // Real photo through the same global drop entrypoint, using a warm session.
  const person = await fs.readFile('tests/person.jpg');
  const secondStart = Date.now();
  await page.evaluate(
    ({ bytes }) => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([new Uint8Array(bytes)], 'person.jpg', { type: 'image/jpeg' }),
      );
      window.dispatchEvent(
        new DragEvent('dragenter', { dataTransfer: transfer, bubbles: true }),
      );
      window.dispatchEvent(
        new DragEvent('drop', {
          dataTransfer: transfer,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    { bytes: [...person] },
  );
  await expect(
    page.getByRole('heading', { name: 'A little disappearing act…' }),
  ).toBeVisible();
  await finished(page);
  const secondMs = Date.now() - secondStart;
  const personStats = await pngStats(page);
  expect(personStats).toMatchObject({
    width: 960,
    height: 1440,
    type: 'image/png',
  });
  expect(personStats.transparent).toBeGreaterThan(0.1);
  expect(personStats.opaque).toBeGreaterThan(0.1);
  const [personDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download PNG' }).click(),
  ]);
  await personDownload.saveAs(testInfo.outputPath('person-cutout.png'));

  // Actual OS clipboard and keyboard paste with a PNG that already contains alpha.
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(async () => {
    const blob = await (await fetch('/example-cutout.png')).blob();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  });
  await page.keyboard.press('Control+v');
  await expect(
    page.getByRole('heading', { name: 'A little disappearing act…' }),
  ).toBeVisible();
  await finished(page);
  const pasted = await pngStats(page);
  expect(pasted).toMatchObject({ width: 1600, height: 1200, corner: 0 });
  expect(pasted.opaque).toBeGreaterThan(0.1);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  await testInfo.attach('runtime-evidence', {
    body: JSON.stringify(
      {
        firstMs,
        secondMs,
        stats,
        personStats,
        pasted,
        worstMainThreadIntervalMs: Math.max(...timings),
        unexpectedWriteRequests: requests,
        cloudflarePerformanceBeaconSizes: performanceBeacons,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });
});

test('invalid files, cancellation, failed model download, and retry', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.site-shell')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await page.getByLabel('Upload photo', { exact: true }).setInputFiles({
    name: 'wrong.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  });
  await expect(page.getByRole('alert')).toContainText('JPG, PNG, or WebP');
  await page.getByLabel('Upload photo', { exact: true }).setInputFiles({
    name: 'corrupt.png',
    mimeType: 'image/png',
    buffer: Buffer.from('broken image'),
  });
  await expect(page.getByRole('alert')).toBeVisible();
  await page.route('**/models/**', (route) => route.abort());
  await page.getByLabel('Upload photo', { exact: true }).setInputFiles(fixture);
  await expect(page.getByRole('alert')).toContainText('couldn’t', {
    timeout: 30_000,
  });
  await page.unroute('**/models/**');
  await page.getByRole('button', { name: 'Retry removal' }).click();
  await expect(
    page.getByRole('button', { name: 'Cancel', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Remove the background.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Try this photo' }).click();
  await finished(page);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('mobile layout, touch comparison, and reduced motion', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(process.env.BASE_URL || 'http://localhost:3090');
  await expect(page.locator('.site-shell')).toHaveAttribute(
    'data-ready',
    'true',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('mobile-home.png'),
    fullPage: true,
  });
  const comparison = page.locator('.demo-comparison');
  await comparison.scrollIntoViewIfNeeded();
  const box = await comparison.boundingBox();
  await page.touchscreen.tap(
    box!.x + box!.width * 0.8,
    box!.y + box!.height / 2,
  );
  await expect
    .poll(async () =>
      Number(await page.getByRole('slider').getAttribute('aria-valuenow')),
    )
    .toBeGreaterThan(70);
  await page.getByLabel('Upload photo', { exact: true }).setInputFiles(fixture);
  await finished(page);
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuenow', '0');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('mobile-result.png'),
    fullPage: true,
  });
  await context.close();
});
