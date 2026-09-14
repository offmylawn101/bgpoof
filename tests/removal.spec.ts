import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

test.use({ serviceWorkers: 'block' });

const fixture = 'public/example.jpg';
async function finished(page: import('@playwright/test').Page) {
  await expect(page.getByRole('link', { name: 'Download PNG' })).toBeVisible({
    timeout: 120_000,
  });
  const readyAt = Date.now();
  await expect(page.locator('.photo-comparison')).not.toHaveClass(/revealing/, {
    timeout: 5000,
  });
  return { readyAt, revealedAt: Date.now() };
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

type ImageHit = { tag: string | null; src: string | null };
type ContextMenuHit = ImageHit & { defaultPrevented: boolean };

async function resultImage(
  page: import('@playwright/test').Page,
  width: number,
  height: number,
  checkContextMenu = false,
) {
  const frame = page.locator('.photo-comparison');
  const image = page.getByRole('img', {
    name: 'Your photo with a transparent background',
  });
  const downloadUrl = await page
    .getByRole('link', { name: 'Download PNG' })
    .getAttribute('href');
  await expect(image).toHaveAttribute('src', downloadUrl!);
  await expect(image).toHaveJSProperty('naturalWidth', width);
  await expect(image).toHaveJSProperty('naturalHeight', height);
  await expect(frame.getByRole('slider')).toHaveCount(0);
  await frame.scrollIntoViewIfNeeded();
  const box = (await frame.boundingBox())!;
  expect(box.width).toBeGreaterThan(0);
  expect(box.height).toBeGreaterThan(0);
  expect(
    Math.abs(box.width - (box.height * width) / height),
    'The checkerboard frame must follow the uploaded photo aspect ratio',
  ).toBeLessThanOrEqual(2);
  const points = [
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    { x: box.x + 24, y: box.y + 24 },
  ];
  const hitTargets = await page.evaluate(
    (points) =>
      points.map(({ x, y }) => {
        const target = document.elementFromPoint(x, y);
        return {
          tag: target?.tagName || null,
          src: target instanceof HTMLImageElement ? target.currentSrc : null,
        };
      }),
    points,
  );
  const expectedHits = points.map(() => ({ tag: 'IMG', src: downloadUrl }));
  expect(
    hitTargets,
    'The result image must receive input at its center and near its corner',
  ).toEqual(expectedHits);

  let contextMenus: ContextMenuHit[] = [];
  if (checkContextMenu) {
    await page.evaluate(() => {
      const state = window as Window & {
        resultContextMenus?: ContextMenuHit[];
      };
      state.resultContextMenus = [];
      const observe = (event: MouseEvent) => {
        queueMicrotask(() => {
          const target = event.target;
          state.resultContextMenus!.push({
            tag: target instanceof Element ? target.tagName : null,
            src: target instanceof HTMLImageElement ? target.currentSrc : null,
            defaultPrevented: event.defaultPrevented,
          });
          if (state.resultContextMenus!.length === 2) {
            document.removeEventListener('contextmenu', observe, true);
          }
        });
      };
      document.addEventListener('contextmenu', observe, true);
    });
    for (const { x, y } of points) {
      await page.mouse.click(x, y, { button: 'right' });
      await page.keyboard.press('Escape');
    }
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as Window & { resultContextMenus?: ContextMenuHit[] })
              .resultContextMenus?.length,
        ),
      )
      .toBe(2);
    contextMenus = await page.evaluate(
      () =>
        (window as Window & { resultContextMenus?: ContextMenuHit[] })
          .resultContextMenus!,
    );
    expect(contextMenus).toEqual(
      expectedHits.map((hit) => ({ ...hit, defaultPrevented: false })),
    );
  }
  return {
    frame: { width: box.width, height: box.height },
    hitTargets,
    contextMenus,
  };
}

test('real API upload, wipe, copyable PNG, drop, clipboard, and bounded photo transfer', async ({
  page,
  context,
}, testInfo) => {
  const requests: string[] = [],
    errors: string[] = [];
  const modelRuntimeRequests: string[] = [];
  const photoUploads: {
    bytes: number;
    contentType: string;
    measurement: string;
  }[] = [];
  const uploadMeasurements: Promise<void>[] = [];
  const uploadMeasurementErrors: string[] = [];
  const performanceBeacons: number[] = [];
  const analyticsBeacons: number[] = [];
  // Dedicated-worker fetches must be observed at the browser-context level.
  context.on('request', (r) => {
    const url = new URL(r.url());
    if (
      /\/(models|runtime)\//.test(url.pathname) ||
      /\.(onnx|wasm)$/.test(url.pathname)
    ) {
      modelRuntimeRequests.push(r.url());
    }
    if (['GET', 'HEAD'].includes(r.method())) return;
    const sameOrigin =
      url.origin ===
      new URL(process.env.BASE_URL || 'http://localhost:3090').origin;
    const bytes = r.postDataBuffer()?.length || 0;
    if (
      r.method() === 'POST' &&
      sameOrigin &&
      url.pathname === '/api/remove-background'
    ) {
      const upload = {
        bytes: 0,
        contentType: r.headers()['content-type'] || '',
        measurement: 'pending',
      };
      photoUploads.push(upload);
      uploadMeasurements.push(
        (async () => {
          const response = await r.response();
          if (!response) throw new Error('Photo upload has no response.');
          const failure = await response.finished();
          if (failure) throw failure;
          const [sizes, headers] = await Promise.all([
            r.sizes(),
            r.allHeaders(),
          ]);
          // Chromium omits Blob bodies from postDataBuffer and sometimes sizes().
          // Its actual Content-Length matched bytes received by an HTTP test server.
          upload.bytes =
            sizes.requestBodySize || Number(headers['content-length'] || 0);
          upload.measurement = sizes.requestBodySize
            ? 'request.sizes'
            : 'content-length';
          upload.contentType = headers['content-type'] || upload.contentType;
        })().catch((error) => {
          uploadMeasurementErrors.push(String(error));
        }),
      );
      return;
    }
    if (
      r.method() === 'POST' &&
      sameOrigin &&
      url.pathname === '/cdn-cgi/rum' &&
      bytes < 32768 &&
      !/data:image|iVBORw0KGgo|\/9j\//.test(r.postData() || '')
    ) {
      performanceBeacons.push(bytes);
      return;
    }
    const analyticsEvents = (r.postData() || '')
      .split('\n')
      .map((line) => new URLSearchParams(line));
    const analyticsPayload = [
      ...url.searchParams.values(),
      ...analyticsEvents.flatMap((event) => [...event.values()]),
    ].join('\n');
    if (
      r.method() === 'POST' &&
      url.protocol === 'https:' &&
      ['www.google-analytics.com', 'region1.google-analytics.com'].includes(
        url.hostname,
      ) &&
      url.pathname === '/g/collect' &&
      url.searchParams.get('v') === '2' &&
      Boolean(process.env.BGPOOF_TEST_GA_ID) &&
      url.searchParams.get('tid') === process.env.BGPOOF_TEST_GA_ID &&
      analyticsEvents.every((event) => !event.has('tid')) &&
      bytes < 32768 &&
      !/image\/|data:image|iVBORw0KGgo|\/9j\/|\.(?:jpe?g|png|webp)(?:$|[\s?&#])/i.test(
        `${r.headers()['content-type'] || ''}\n${analyticsPayload}`,
      )
    ) {
      analyticsBeacons.push(bytes);
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
  const demoSlider = page.locator('.demo-comparison').getByRole('slider');
  await demoSlider.focus();
  await page.keyboard.press('End');
  await expect(demoSlider).toHaveAttribute('aria-valuenow', '100');
  await page.keyboard.press('Home');
  await expect(demoSlider).toHaveAttribute('aria-valuenow', '0');
  await page.keyboard.press('ArrowRight');
  await expect(demoSlider).toHaveAttribute('aria-valuenow', '1');
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
  const first = await finished(page);
  const firstTiming = {
    cutoutReadyMs: first.readyAt - started,
    revealCompleteMs: first.revealedAt - started,
  };
  expect(photoUploads).toHaveLength(1);
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
  const landscapeImage = await resultImage(page, 1600, 1200, true);
  await page.getByRole('button', { name: 'Show original' }).click();
  await expect(page.getByRole('button', { name: 'Show cutout' })).toBeVisible();
  const originalUrl = await page
    .getByRole('img', { name: 'Your original photo' })
    .getAttribute('src');
  await expect
    .poll(() =>
      page.locator('.photo-comparison').evaluate((frame) => {
        const box = frame.getBoundingClientRect();
        const target = document.elementFromPoint(
          box.x + box.width / 2,
          box.y + box.height / 2,
        );
        return target instanceof HTMLImageElement ? target.currentSrc : null;
      }),
    )
    .toBe(originalUrl);
  await page.getByRole('button', { name: 'Show cutout' }).click();
  await expect(
    page.getByRole('button', { name: 'Show original' }),
  ).toBeVisible();
  await resultImage(page, 1600, 1200);
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

  // A second real photo through the global drop entrypoint.
  const portrait = await fs.readFile('tests/fixtures/portrait.jpg');
  const secondStart = Date.now();
  await page.evaluate(
    ({ bytes }) => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([new Uint8Array(bytes)], 'portrait.jpg', {
          type: 'image/jpeg',
        }),
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
    { bytes: [...portrait] },
  );
  await expect(
    page.getByRole('heading', { name: 'A little disappearing act…' }),
  ).toBeVisible();
  const second = await finished(page);
  const secondTiming = {
    cutoutReadyMs: second.readyAt - secondStart,
    revealCompleteMs: second.revealedAt - secondStart,
  };
  expect(photoUploads).toHaveLength(2);
  const portraitStats = await pngStats(page);
  expect(portraitStats).toMatchObject({
    width: 821,
    height: 1024,
    type: 'image/png',
  });
  expect(portraitStats.transparent).toBeGreaterThan(0.1);
  expect(portraitStats.opaque).toBeGreaterThan(0.1);
  const portraitImage = await resultImage(page, 821, 1024, true);
  const [portraitDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download PNG' }).click(),
  ]);
  await portraitDownload.saveAs(testInfo.outputPath('portrait-cutout.png'));

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
  expect(photoUploads.length).toBeGreaterThanOrEqual(2);
  expect(photoUploads.length).toBeLessThanOrEqual(3);
  await Promise.all(uploadMeasurements);
  expect(uploadMeasurementErrors).toEqual([]);
  for (const upload of photoUploads) {
    expect(upload.bytes).toBeGreaterThan(0);
    expect(upload.bytes).toBeLessThanOrEqual(2 * 1024 * 1024);
    expect(upload.contentType).toMatch(/^image\/(jpeg|png|webp)(;|$)/);
  }
  expect(modelRuntimeRequests).toEqual([]);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  await testInfo.attach('runtime-evidence', {
    body: JSON.stringify(
      {
        firstTiming,
        secondTiming,
        stats,
        portraitStats,
        landscapeImage,
        portraitImage,
        pasted,
        worstMainThreadIntervalMs: Math.max(...timings),
        unexpectedWriteRequests: requests,
        photoUploads,
        uploadMeasurementErrors,
        modelRuntimeRequests,
        cloudflarePerformanceBeaconSizes: performanceBeacons,
        googleAnalyticsBeaconSizes: analyticsBeacons,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });
});

test('invalid files, API error, retry, and cancellation ignore a late result', async ({
  page,
  context,
}) => {
  let apiCalls = 0;
  let releaseLateResult!: () => void;
  const lateResult = new Promise<void>((resolve) => {
    releaseLateResult = resolve;
  });
  let finishLateResult!: () => void;
  const lateResultFinished = new Promise<void>((resolve) => {
    finishLateResult = resolve;
  });
  const cutout = await fs.readFile('public/example-cutout.png');
  const routePattern = '**/api/remove-background';
  await context.route(routePattern, async (route) => {
    apiCalls++;
    if (apiCalls === 1) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'The remover is busy. Please try again shortly.',
        }),
      });
      return;
    }
    await lateResult;
    try {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: cutout,
      });
    } catch {
      // Terminating the dedicated worker may already have closed its request.
    } finally {
      finishLateResult();
    }
  });
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
  expect(apiCalls).toBe(0);
  await page.getByLabel('Upload photo', { exact: true }).setInputFiles(fixture);
  await expect(page.getByRole('alert')).toContainText('busy', {
    timeout: 30_000,
  });
  expect(apiCalls).toBe(1);
  await page.getByRole('button', { name: 'Retry removal' }).click();
  await expect.poll(() => apiCalls).toBe(2);
  await expect(
    page.getByRole('button', { name: 'Cancel', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Remove the background.' }),
  ).toBeVisible();
  releaseLateResult();
  await lateResultFinished;
  await context.unroute(routePattern);
  await expect(page.getByRole('link', { name: 'Download PNG' })).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
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
    serviceWorkers: 'block',
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
  await resultImage(page, 1600, 1200);
  await expect(
    page.getByRole('button', { name: 'Show original' }),
  ).toBeVisible();
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
