import { expect, test, type Page } from '@playwright/test';

const publicPaths = [
  '/',
  '/about',
  '/how-to-remove-background',
  '/transparent-png',
  '/background-removal-tips',
];

async function inspectHtml(page: Page, html: string) {
  return page.evaluate((source) => {
    const document = new DOMParser().parseFromString(source, 'text/html');
    const contents = (selector: string) =>
      Array.from(
        document.querySelectorAll(selector),
        (element) => element.getAttribute('content') || '',
      );
    return {
      language: document.documentElement.lang,
      titles: Array.from(
        document.querySelectorAll('title'),
        (element) => element.textContent,
      ),
      descriptions: contents('meta[name="description"]'),
      canonicals: Array.from(
        document.querySelectorAll('link[rel="canonical"]'),
        (element) => element.getAttribute('href'),
      ),
      robots: contents('meta[name="robots"]'),
      headings: Array.from(document.querySelectorAll('h1'), (element) => {
        const heading = element.cloneNode(true) as HTMLElement;
        heading
          .querySelectorAll('br')
          .forEach((lineBreak) => lineBreak.replaceWith(' '));
        return heading.textContent?.replace(/\s+/g, ' ').trim();
      }),
      ogTitle: contents('meta[property="og:title"]'),
      ogDescription: contents('meta[property="og:description"]'),
      ogUrl: contents('meta[property="og:url"]'),
      ogImage: contents('meta[property="og:image"]'),
      ogWidth: contents('meta[property="og:image:width"]'),
      ogHeight: contents('meta[property="og:image:height"]'),
      twitterCard: contents('meta[name="twitter:card"]'),
      twitterTitle: contents('meta[name="twitter:title"]'),
      twitterDescription: contents('meta[name="twitter:description"]'),
      twitterImage: contents('meta[name="twitter:image"]'),
      schemas: Array.from(
        document.querySelectorAll('script[type="application/ld+json"]'),
        (element) => JSON.parse(element.textContent || 'null'),
      ),
      links: Array.from(document.querySelectorAll('a[href]'), (element) =>
        element.getAttribute('href'),
      ),
    };
  }, html);
}

test.beforeEach(async ({ context }) => {
  // SEO checks must never spend inference credits or create analytics events.
  await context.route('**/api/remove-background', (route) => route.abort());
  await context.route('https://www.googletagmanager.com/**', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: '' }),
  );
  await context.route('https://**.google-analytics.com/**', (route) =>
    route.abort(),
  );
  await context.route('https://static.cloudflareinsights.com/**', (route) =>
    route.abort(),
  );
  await context.route('https://cloudflareinsights.com/**', (route) =>
    route.abort(),
  );
});

test('every public page has complete, unique metadata before and after hydration', async ({
  page,
  request,
}) => {
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let siteOrigin = '';

  for (const path of publicPaths) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
    const initial = await inspectHtml(page, await response.text());
    expect(initial.language).toBe('en');
    expect(initial.titles).toHaveLength(1);
    expect(initial.titles[0]).toBeTruthy();
    expect(initial.descriptions).toHaveLength(1);
    expect(initial.descriptions[0].length).toBeGreaterThan(50);
    expect(initial.canonicals).toHaveLength(1);
    const canonical = new URL(initial.canonicals[0]!);
    siteOrigin ||= canonical.origin;
    expect(canonical.href).toBe(new URL(path, siteOrigin).href);
    expect(initial.headings).toHaveLength(1);
    expect(initial.headings[0]).toBeTruthy();
    expect(initial.robots.join(',')).not.toMatch(/noindex/i);
    expect(initial.ogTitle).toEqual(initial.titles);
    expect(initial.ogDescription).toEqual(initial.descriptions);
    expect(initial.ogUrl).toEqual(initial.canonicals);
    expect(initial.ogImage).toEqual([
      new URL('/social-preview.png', siteOrigin).href,
    ]);
    expect(initial.ogWidth).toEqual(['1200']);
    expect(initial.ogHeight).toEqual(['630']);
    expect(initial.twitterCard).toEqual(['summary_large_image']);
    expect(initial.twitterTitle).toEqual(initial.titles);
    expect(initial.twitterDescription).toEqual(initial.descriptions);
    expect(initial.twitterImage).toEqual(initial.ogImage);
    expect(initial.schemas.length).toBeGreaterThan(0);
    const graph = initial.schemas.flatMap(
      (schema) => schema['@graph'] || [schema],
    );
    expect(graph).toContainEqual(
      expect.objectContaining({
        '@type': path === '/about' ? 'AboutPage' : 'WebPage',
        url: canonical.href,
        name: initial.titles[0],
        description: initial.descriptions[0],
      }),
    );
    if (path === '/') {
      expect(graph).toContainEqual(
        expect.objectContaining({ '@type': 'WebSite', url: canonical.href }),
      );
      expect(initial.titles[0]).toBe(
        'BG Poof — Remove photo backgrounds for free',
      );
      expect(initial.headings).toEqual(['Remove photo backgrounds.']);
      for (const linkedPath of publicPaths.slice(1))
        expect(initial.links).toContain(linkedPath);
    } else {
      const breadcrumbs = graph.find(
        (node) => node['@type'] === 'BreadcrumbList',
      );
      expect(
        breadcrumbs?.itemListElement.map((item: { item: string }) => item.item),
      ).toEqual([new URL('/', siteOrigin).href, canonical.href]);
      expect(initial.links).toContain('/');
    }
    titles.add(initial.titles[0]!);
    descriptions.add(initial.descriptions[0]);

    await page.goto(path);
    await page.waitForLoadState('networkidle');
    if (path === '/')
      await expect(page.locator('.site-shell')).toHaveAttribute(
        'data-ready',
        'true',
      );
    await expect(page.locator('head title')).toHaveCount(1);
    await expect(page.locator('head link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('head meta[name="description"]')).toHaveCount(1);
    const hydrated = await inspectHtml(page, await page.content());
    expect(hydrated, `hydrated metadata at ${path}`).toEqual(initial);
  }
  expect(titles.size).toBe(publicPaths.length);
  expect(descriptions.size).toBe(publicPaths.length);
  expect(errors).toEqual([]);
});

test('robots and sitemap expose only canonical public pages, and the social card is a real PNG', async ({
  page,
  request,
}) => {
  const home = await request.get('/');
  const metadata = await inspectHtml(page, await home.text());
  const siteOrigin = new URL(metadata.canonicals[0]!).origin;
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(robots.headers()['content-type']).toContain('text/plain');
  const directives = await robots.text();
  expect(directives).toMatch(/^User-agent:\s*\*\s*$/m);
  expect(directives).toMatch(/^Allow:\s*\/\s*$/m);
  expect(directives).toMatch(/^Disallow:\s*\/api\/\s*$/m);
  expect(directives).toContain(`Sitemap: ${siteOrigin}/sitemap.xml`);
  expect(directives).not.toContain('<html');

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()['content-type']).toMatch(
    /(?:application|text)\/xml/,
  );
  const parsed = await page.evaluate(
    (xml) => {
      const document = new DOMParser().parseFromString(xml, 'application/xml');
      return {
        namespace: document.documentElement.namespaceURI,
        errors: document.querySelectorAll('parsererror').length,
        locations: Array.from(
          document.querySelectorAll('url > loc'),
          (node) => node.textContent,
        ),
      };
    },
    await sitemap.text(),
  );
  expect(parsed.namespace).toBe('http://www.sitemaps.org/schemas/sitemap/0.9');
  expect(parsed.errors).toBe(0);
  expect(parsed.locations.sort()).toEqual(
    publicPaths.map((path) => new URL(path, siteOrigin).href).sort(),
  );

  const social = await request.get('/social-preview.png');
  expect(social.status()).toBe(200);
  expect(social.headers()['content-type']).toContain('image/png');
  const png = await social.body();
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
});

test('unknown pages return 404 with noindex and trailing slashes redirect once', async ({
  page,
  request,
}) => {
  const missing = await request.get('/no-such-page-seo-check');
  expect(missing.status()).toBe(404);
  const metadata = await inspectHtml(page, await missing.text());
  expect(
    `${missing.headers()['x-robots-tag'] || ''},${metadata.robots.join(',')}`,
  ).toMatch(/noindex/i);
  expect(metadata.headings).toHaveLength(1);
  expect(metadata.links).toContain('/');

  for (const path of publicPaths.slice(1)) {
    const redirect = await request.get(`${path}/?from=seo-check`, {
      maxRedirects: 0,
    });
    expect(redirect.status(), path).toBe(308);
    const destination = new URL(redirect.headers().location, redirect.url());
    expect(destination.pathname).toBe(path);
    expect(destination.search).toBe('?from=seo-check');
    const target = await request.get(
      `${destination.pathname}${destination.search}`,
      { maxRedirects: 0 },
    );
    expect(target.status()).toBe(200);
  }
});

test('help pages remain reachable from the uploader and return visitors to it', async ({
  page,
}) => {
  for (const path of publicPaths.slice(1)) {
    await page.goto('/');
    const link = page.locator(`a[href="${path}"]:visible`).first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.locator('a[href="/"]').first().click();
    await expect(
      page.getByRole('button', { name: 'Upload image', exact: true }),
    ).toBeEnabled();
  }
});

test('the mobile uploader stays in the first screen and every page fits the viewport', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of publicPaths) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(391);
    if (path === '/') {
      const upload = page.getByRole('button', {
        name: 'Upload image',
        exact: true,
      });
      await expect(upload).toBeEnabled();
      const bounds = await upload.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
      await page.screenshot({
        path: testInfo.outputPath('seo-mobile-home.png'),
        fullPage: true,
      });
    }
  }
});
