import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

// Keep private reference images untracked and supply local paths explicitly.
const originalPath = process.env.BGPOOF_QUALITY_ORIGINAL;
const referencePath = process.env.BGPOOF_QUALITY_REFERENCE;
const strict = process.env.BGPOOF_QUALITY_STRICT === '1';
const thresholds = {
  minimumForegroundIoU:
    process.env.BGPOOF_QUALITY_MIN_IOU === undefined
      ? strict
        ? 0.95
        : null
      : Number(process.env.BGPOOF_QUALITY_MIN_IOU),
  maximumAlphaMAE:
    process.env.BGPOOF_QUALITY_MAX_MAE === undefined
      ? strict
        ? 0.04
        : null
      : Number(process.env.BGPOOF_QUALITY_MAX_MAE),
};

test('measure downloaded cutout quality against the supplied reference', async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    !originalPath || !referencePath,
    'Set BGPOOF_QUALITY_ORIGINAL and BGPOOF_QUALITY_REFERENCE to local image paths.',
  );
  test.setTimeout(300_000);
  for (const [name, value] of Object.entries(thresholds)) {
    if (value !== null) {
      expect(Number.isFinite(value), `${name} must be a finite number`).toBe(
        true,
      );
      expect(value, `${name} must be between 0 and 1`).toBeGreaterThanOrEqual(
        0,
      );
      expect(value, `${name} must be between 0 and 1`).toBeLessThanOrEqual(1);
    }
  }
  const original = path.resolve(originalPath!);
  const reference = path.resolve(referencePath!);
  await Promise.all([fs.access(original), fs.access(reference)]);
  const uploadBytes: number[] = [];
  const uploadByteSources: string[] = [];
  const uploadMeasurements: Promise<void>[] = [];
  const uploadMeasurementErrors: string[] = [];
  const pipeline: { refinement: string | null; serverTiming: string | null }[] =
    [];
  const modelRuntimeRequests: string[] = [];
  const origin = new URL(process.env.BASE_URL || 'http://localhost:3090')
    .origin;
  context.on('request', (request) => {
    const url = new URL(request.url());
    if (
      /\/(models|runtime)\//.test(url.pathname) ||
      /\.(onnx|wasm)$/.test(url.pathname)
    ) {
      modelRuntimeRequests.push(request.url());
    }
    if (
      request.method() === 'POST' &&
      url.origin === origin &&
      url.pathname === '/api/remove-background'
    ) {
      const index = uploadBytes.length;
      uploadBytes.push(0);
      uploadByteSources.push('pending');
      uploadMeasurements.push(
        (async () => {
          const response = await request.response();
          if (!response) throw new Error('Photo upload has no response.');
          pipeline.push({
            refinement: await response.headerValue('x-bgpoof-refinement'),
            serverTiming: await response.headerValue('server-timing'),
          });
          const failure = await response.finished();
          if (failure) throw failure;
          const [sizes, headers] = await Promise.all([
            request.sizes(),
            request.allHeaders(),
          ]);
          // Blob-backed worker requests can report zero bytes through sizes().
          // Chromium's Content-Length was verified against actual server receipts.
          uploadBytes[index] =
            sizes.requestBodySize || Number(headers['content-length'] || 0);
          uploadByteSources[index] = sizes.requestBodySize
            ? 'request.sizes'
            : 'content-length';
        })().catch((error) => {
          uploadMeasurementErrors.push(String(error));
        }),
      );
    }
  });

  await page.goto('/');
  await expect(page.locator('.site-shell')).toHaveAttribute(
    'data-ready',
    'true',
  );
  const started = Date.now();
  await page.evaluate(() => {
    const state = {
      started: 0,
      previewReadyMs: 0,
      revealCompleteMs: 0,
      downloadReadyMs: 0,
    };
    Object.assign(window, { bgPoofTiming: state });
    document.querySelector('input[type=file]')!.addEventListener(
      'change',
      () => {
        state.started = performance.now();
        const sample = () => {
          const elapsed = performance.now() - state.started;
          const preview = document.querySelector<HTMLImageElement>(
            '.photo-comparison .result-image',
          );
          if (preview?.complete && preview.naturalWidth) {
            state.previewReadyMs ||= elapsed;
            if (!preview.parentElement!.classList.contains('revealing'))
              state.revealCompleteMs ||= elapsed;
          }
          if (document.querySelector('a.download-button'))
            state.downloadReadyMs ||= elapsed;
          if (
            (!state.downloadReadyMs || !state.revealCompleteMs) &&
            elapsed < 30_000
          )
            requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      },
      { capture: true, once: true },
    );
  });
  await page
    .getByLabel('Upload photo', { exact: true })
    .setInputFiles(original);
  const downloadLink = page.getByRole('link', { name: 'Download PNG' });
  await expect(downloadLink).toBeVisible({ timeout: 240_000 });
  const cutoutReadyMs = Date.now() - started;
  await expect(page.locator('.photo-comparison')).not.toHaveClass(/revealing/, {
    timeout: 10_000,
  });
  const revealCompleteMs = Date.now() - started;
  const browserTimings = await page.evaluate(
    () =>
      (
        window as Window & {
          bgPoofTiming?: {
            previewReadyMs: number;
            revealCompleteMs: number;
            downloadReadyMs: number;
          };
        }
      ).bgPoofTiming,
  );
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    downloadLink.click(),
  ]);
  const outputPath = testInfo.outputPath('quality-cutout.png');
  await download.saveAs(outputPath);
  const elapsedMs = Date.now() - started;
  const timings = {
    cutoutReadyMs,
    revealCompleteMs,
    downloadSavedMs: elapsedMs,
  };
  await Promise.all(uploadMeasurements);
  await testInfo.attach('quality-cutout', {
    path: outputPath,
    contentType: 'image/png',
  });
  expect((await fs.readFile(outputPath)).subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );

  // Decode local files in an isolated blank page, without serving or uploading them.
  // This also checks source dimensions independently of the application's preview.
  const comparisonPage = await context.newPage();
  let comparison;
  try {
    await comparisonPage.setContent('<input type="file" multiple>');
    await comparisonPage
      .locator('input')
      .setInputFiles([original, reference, outputPath]);
    comparison = await comparisonPage
      .locator('input')
      .evaluate(async (element) => {
        const files = (element as HTMLInputElement).files!;
        const source = await createImageBitmap(files[0]);
        const original = { width: source.width, height: source.height };
        const expected = await createImageBitmap(files[1]);
        const actual = await createImageBitmap(files[2]);
        try {
          const width = expected.width;
          const height = expected.height;
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d', {
            willReadFrequently: true,
          })!;
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = 'high';
          context.drawImage(source, 0, 0, width, height);
          const sourcePixels = context.getImageData(0, 0, width, height).data;
          source.close();
          context.clearRect(0, 0, width, height);
          context.drawImage(expected, 0, 0);
          const target = context.getImageData(0, 0, width, height).data;
          context.clearRect(0, 0, width, height);
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = 'high';
          context.drawImage(actual, 0, 0, width, height);
          const result = context.getImageData(0, 0, width, height).data;
          let absoluteAlphaError = 0;
          let truePositive = 0;
          let falsePositive = 0;
          let falseNegative = 0;
          let originalAlphaViolations = 0;
          for (let i = 3; i < target.length; i += 4) {
            absoluteAlphaError += Math.abs(result[i] - target[i]);
            // Background removal may reduce original alpha, but must not restore it.
            if (result[i] > sourcePixels[i] + 1) originalAlphaViolations++;
            const predictedForeground = result[i] >= 128;
            const expectedForeground = target[i] >= 128;
            if (predictedForeground && expectedForeground) truePositive++;
            else if (predictedForeground) falsePositive++;
            else if (expectedForeground) falseNegative++;
          }
          const pixels = width * height;
          const referenceForeground = truePositive + falseNegative;
          const predictedForeground = truePositive + falsePositive;
          const union = truePositive + falsePositive + falseNegative;
          return {
            original,
            reference: { width, height },
            output: { width: actual.width, height: actual.height },
            alphaMAE: absoluteAlphaError / (pixels * 255),
            foregroundIoU: union ? truePositive / union : 1,
            recall: referenceForeground
              ? truePositive / referenceForeground
              : 1,
            precision: predictedForeground
              ? truePositive / predictedForeground
              : referenceForeground
                ? 0
                : 1,
            pixels,
            referenceForeground,
            predictedForeground,
            truePositive,
            falsePositive,
            falseNegative,
            originalAlphaViolations,
            foregroundThreshold: 128,
            resize: 'Canvas 2D high-quality smoothing to reference dimensions',
          };
        } finally {
          expected.close();
          actual.close();
        }
      });
  } finally {
    await comparisonPage.close();
  }

  const metrics = {
    browserTimings,
    ...comparison,
    elapsedMs,
    timings,
    thresholds,
    strict,
    uploadBytes,
    uploadByteSources,
    uploadMeasurementErrors,
    modelRuntimeRequests,
    pipeline,
  };
  const metricsPath = testInfo.outputPath('quality-metrics.json');
  await fs.writeFile(metricsPath, JSON.stringify(metrics, null, 2) + '\n');
  await testInfo.attach('quality-metrics', {
    path: metricsPath,
    contentType: 'application/json',
  });
  console.log('Cutout quality:', JSON.stringify(metrics));

  expect(uploadMeasurementErrors).toEqual([]);
  expect(uploadBytes).toHaveLength(1);
  if (process.env.BGPOOF_REQUIRE_GRABCUT === '1') {
    expect(pipeline).toHaveLength(1);
    expect(pipeline[0].refinement, 'Initial removal must include GrabCut').toBe(
      'grabcut',
    );
    expect(pipeline[0].serverTiming).toMatch(/grabcut;dur=/);
  }
  expect(uploadBytes[0]).toBeGreaterThan(0);
  expect(uploadBytes[0]).toBeLessThanOrEqual(2 * 1024 * 1024);
  expect(modelRuntimeRequests).toEqual([]);
  expect(
    comparison.output,
    'PNG must retain the source pixel dimensions',
  ).toEqual(comparison.original);
  expect(
    Math.abs(
      comparison.original.width / comparison.original.height -
        comparison.reference.width / comparison.reference.height,
    ),
    'The reference must show the same uncropped image, within one pixel of rounding',
  ).toBeLessThanOrEqual(1 / comparison.reference.height);
  expect(
    comparison.referenceForeground,
    'Reference must contain a subject',
  ).toBeGreaterThan(0);
  expect(
    comparison.referenceForeground,
    'Reference must contain removed background',
  ).toBeLessThan(comparison.pixels);
  expect(
    comparison.predictedForeground,
    'Cutout must retain a subject',
  ).toBeGreaterThan(0);
  expect(
    comparison.predictedForeground,
    'Cutout must remove background',
  ).toBeLessThan(comparison.pixels);
  expect(
    comparison.originalAlphaViolations,
    'Original transparency must be preserved',
  ).toBe(0);
  if (thresholds.minimumForegroundIoU !== null) {
    expect
      .soft(comparison.foregroundIoU, 'Foreground overlap with the reference')
      .toBeGreaterThanOrEqual(thresholds.minimumForegroundIoU);
  }
  if (thresholds.maximumAlphaMAE !== null) {
    expect
      .soft(comparison.alphaMAE, 'Mean alpha error, normalized to 0–1')
      .toBeLessThanOrEqual(thresholds.maximumAlphaMAE);
  }
});
