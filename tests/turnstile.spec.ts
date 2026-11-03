import { test, expect, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

// Stand-ins for Cloudflare's script, so these run without a real check.
const fakes = {
  // Fails once, then succeeds on Turnstile's own retry, after the old 8 s cutoff.
  retry: `window.turnstile = { remove() {}, render(container, options) {
    window.fakeRendered = true;
    setTimeout(() => options['error-callback']('600010'), 100);
    setTimeout(() => options.callback('late-token'), 12000);
    return 'widget';
  } };`,
  // Needs the visitor to tick a box, and they take longer than the normal wait.
  checkbox: `window.turnstile = { remove() {}, render(container, options) {
    window.fakeRendered = true;
    setTimeout(() => {
      options['before-interactive-callback']();
      const box = document.createElement('button');
      box.textContent = 'Verify you are human';
      box.onclick = () => options.callback('ticked-token');
      container.append(box);
    }, 100);
    return 'widget';
  } };`,
};

async function upload(page: Page, fake: keyof typeof fakes) {
  await page.goto('/about');
  test.skip(
    !(await page.getByRole('heading', { name: 'Abuse protection' }).count()),
    'Needs VITE_BGPOOF_TURNSTILE_SITE_KEY',
  );
  await page.route('https://challenges.cloudflare.com/turnstile/**', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: fakes[fake] }),
  );
  const sent = new Promise<string | undefined>((resolve) =>
    page.context().route('**/api/remove-background', async (route) => {
      resolve(route.request().headers()['x-bgpoof-verification']);
      await route.fulfill({ status: 503, json: { error: 'Stopped by test.' } });
    }),
  );
  await page.clock.install();
  await page.goto('/');
  await expect(page.locator('.site-shell')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await page
    .getByLabel('Upload photo', { exact: true })
    .setInputFiles('public/example.jpg');
  await expect
    .poll(() => page.evaluate(() => 'fakeRendered' in window))
    .toBe(true);
  // Wrapped, because awaiting upload() must not wait for the request.
  return { sent };
}

test('a check that fails once is retried, not sent empty', async ({ page }) => {
  const { sent } = await upload(page, 'retry');
  await page.clock.runFor(13_000);
  expect(await sent).toBe('late-token');
});

test('a visitor who must tick the checkbox can see it and has time', async ({
  page,
}) => {
  const { sent } = await upload(page, 'checkbox');
  await page.clock.runFor(60_000);
  await page.getByRole('button', { name: 'Verify you are human' }).click();
  expect(await sent).toBe('ticked-token');
});
