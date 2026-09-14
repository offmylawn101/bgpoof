import { expect, test } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.route('https://www.googletagmanager.com/**', (route) =>
    route.abort(),
  );
  await context.route('https://**.google-analytics.com/**', (route) =>
    route.abort(),
  );
});

test('the shared processing count loads independently without moving the mobile uploader', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let finish: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route('**/api/stats', async (route) => {
    await ready;
    await route.fulfill({
      json: { imagesProcessed: 12345, since: '2026-09-14T12:00:00.000Z' },
    });
  });
  await page.goto('/');
  const upload = page.getByRole('button', {
    name: 'Upload image',
    exact: true,
  });
  await expect(upload).toBeEnabled();
  const before = (await upload.boundingBox())!;
  expect(before.y + before.height).toBeLessThan(844);
  await expect(page.locator('.processing-stats')).toBeEmpty();
  finish();
  await expect(page.locator('.processing-stats')).toHaveText(
    '12,345 images processed',
  );
  await expect(
    page
      .locator('.hero-footer')
      .getByRole('link', { name: 'offmylawn', exact: true }),
  ).toHaveAttribute('href', 'https://offmylawn.com/');
  const after = (await upload.boundingBox())!;
  expect(after.y).toBe(before.y);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test('zero and singular counts are honest, and unavailable or malformed stats leave the tool usable', async ({
  page,
}) => {
  for (const [data, status, label] of [
    [
      { imagesProcessed: 0, since: '2026-09-14T12:00:00.000Z' },
      200,
      '0 images processed',
    ],
    [
      { imagesProcessed: 1, since: '2026-09-14T12:00:00.000Z' },
      200,
      '1 image processed',
    ],
    [{ error: 'Statistics are temporarily unavailable.' }, 503, ''],
    [{ imagesProcessed: -1, since: 'invalid' }, 200, ''],
    [null, 200, ''],
  ] as const) {
    await page.route('**/api/stats', (route) =>
      route.fulfill({ status, json: data }),
    );
    const fetched = page.waitForResponse('**/api/stats');
    await page.goto('/');
    await fetched;
    await expect(
      page.getByRole('button', { name: 'Upload image', exact: true }),
    ).toBeEnabled();
    if (label)
      await expect(page.locator('.processing-stats')).toContainText(label);
    else await expect(page.locator('.processing-stats')).toBeEmpty();
    await page.unroute('**/api/stats');
  }
});
