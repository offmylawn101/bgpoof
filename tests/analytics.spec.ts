import { test, expect } from '@playwright/test';

const measurementId = 'G-2L8534ZQ4J';
const tagUrl = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;

test('Google Analytics initializes once on each page without blocking the app', async ({
  page,
  context,
}) => {
  const tagRequests: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Keep this check deterministic and avoid recording synthetic page views.
  await context.route('https://www.googletagmanager.com/gtag/js?*', (route) => {
    tagRequests.push(route.request().url());
    return route.fulfill({ contentType: 'text/javascript', body: '' });
  });
  await context.route('https://**.google-analytics.com/**', (route) =>
    route.abort(),
  );

  const checkInitialization = async () => {
    const scripts = page.locator(`head script[src="${tagUrl}"]`);
    await expect(scripts).toHaveCount(1);
    await expect(scripts).toHaveAttribute('async', '');
    const commands = await page.evaluate(() => {
      const state = window as Window & { dataLayer?: IArguments[] };
      return (state.dataLayer || []).map((command) => Array.from(command));
    });
    expect(commands.filter(([name]) => name === 'js')).toHaveLength(1);
    expect(commands.filter(([name]) => name === 'config')).toEqual([
      ['config', measurementId],
    ]);
  };

  await page.goto('/');
  await expect(page).toHaveTitle('BG Poof — Remove photo backgrounds for free');
  await expect(page.locator('.site-shell')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await expect(
    page.getByRole('button', { name: 'Upload image' }),
  ).toBeVisible();
  await checkInitialization();

  await page.goto('/about');
  await expect(page).toHaveTitle('About & licenses — BG Poof');
  await expect(
    page.getByRole('heading', { name: 'Your photos stay yours.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Analytics', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Your photos are not included in analytics/),
  ).toBeVisible();
  await expect(
    page.getByText(/Our server then automatically checks/),
  ).toBeVisible();
  await checkInitialization();

  await page.getByRole('link', { name: '← Back to BG Poof' }).click();
  await expect(page.locator('.site-shell')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await checkInitialization();
  expect(tagRequests).toEqual([tagUrl, tagUrl, tagUrl]);
  expect(errors).toEqual([]);
});

test('blocking Google Analytics leaves the uploader usable', async ({
  page,
  context,
}) => {
  await context.route('https://www.googletagmanager.com/**', (route) =>
    route.abort(),
  );
  await context.route('https://**.google-analytics.com/**', (route) =>
    route.abort(),
  );
  await page.goto('/');
  await expect(page.locator('.site-shell')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await expect(
    page.getByRole('button', { name: 'Upload image' }),
  ).toBeEnabled();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Upload image' }).click();
  expect((await chooser).isMultiple()).toBe(false);
});
