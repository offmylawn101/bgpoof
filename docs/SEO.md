# Search visibility

BG Poof keeps the background remover first and places instructions, common questions, and guide links below it. Supporting pages answer distinct tasks rather than repeating the same tool under different keyword URLs.

## Public pages

| Route                       | Purpose                                                                        |
| --------------------------- | ------------------------------------------------------------------------------ |
| `/`                         | Free photo background removal, instructions, file limits, and common questions |
| `/how-to-remove-background` | Upload, paste, save, compare, and use the tool on a phone                      |
| `/transparent-png`          | Understand transparency, checkerboards, copying, and PNG versus JPG            |
| `/background-removal-tips`  | Diagnose missing details and describe the limits of automatic cutouts          |
| `/about`                    | Processing, privacy, analytics, limits, and credits                            |

`lib/seo.ts` owns the page inventory, metadata, absolute URLs, and structured data. Update that inventory when adding or removing a public page. Titles and descriptions must describe the actual page. Keep links visible and useful. Do not add invented review scores, dates, performance promises, or claims of perfect removal.

The JSON-LD describes the website and its pages, with breadcrumbs matching visible navigation. No ratings, software rich-result eligibility, or FAQ rich-result eligibility are claimed. The 1200 × 630 PNG social card uses the same credited demo photo as the uploader; social metadata is provided for every page.

## Deployment behavior

Set `VITE_BGPOOF_SITE_URL` to the public origin and rebuild. On BG Poof this is `https://bgpoof.com`.

- Public pages have absolute self-canonicals and Open Graph URLs.
- HTTP and `www` requests redirect to the configured origin. Non-API page URLs with trailing slashes redirect to the path without a slash, preserving query parameters.
- Other Worker hostnames receive `X-Robots-Tag: noindex, follow`. Error responses and processing endpoints receive `noindex`.
- Unknown pages return a real 404 with a link back to the tool.
- `/robots.txt` allows public pages, excludes `/api/`, and advertises `/sitemap.xml`. Cloudflare may prepend its own managed robots directives; verify the final response after deployment.
- The sitemap lists only the five public canonical URLs. It omits arbitrary `priority`, `changefreq`, and fabricated `lastmod` values.

## Verify a release

```sh
npm run check
npm run build
npx playwright install chrome
npm run test:seo
BASE_URL=https://bgpoof.com npm run test:seo
```

The local SEO preview runs the built Worker without production bindings, account settings, routes, or secrets. The tests inspect raw server HTML and hydrated pages, parse the XML/JSON-LD, check the social PNG dimensions, follow internal navigation, and inspect mobile layout. They block analytics and never call image removal. The deployment command and GitHub Actions both run these checks.

Measure the homepage separately with a mobile Lighthouse run and inspect Core Web Vitals in Search Console when enough field data exists. A lab score is a diagnostic, not a ranking forecast. Check the uploader and a real image removal after changes to its component or assets.

## Search Console and ongoing work

1. In Google Search Console, add the `bgpoof.com` domain property. Verify with the Google-provided DNS TXT record in the domain's Cloudflare account, or use an existing verified property. Analytics installation alone is not proof of Search Console ownership.
2. Submit `https://bgpoof.com/sitemap.xml`. Inspect the homepage and new guides using the live URL test; request indexing once for pages that are ready.
3. Monitor indexing reports, then compare search impressions, clicks, queries, and landing pages over several weeks. Check mobile Core Web Vitals when available. Keep branded searches separate from queries such as “remove photo background” when evaluating discovery.
4. Improve guides where real queries or recurring support questions reveal a missing answer. Recheck their statements whenever upload limits, privacy, or processing behavior changes.
5. Seek relevant links through actual use: a project listing, a tutorial using BG Poof, or a user sharing a useful cutout. Do not buy link packages or generate repetitive pages.

Search Console account ownership, sitemap submission, and indexing are separate from deployment and must be verified in that service. These code changes do not claim that Google has indexed the pages.

## Reference review and sources

SpaceDownloader on this server supplied the content/discovery reference: 17 crawlable pages with distinct metadata, a sitemap, and linked guides. Its public source lacked social cards and structured data, and some guide claims were stale. BG Poof adopts the useful structure with fewer, focused pages and adds automated checks rather than copying the corpus.

- [Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide): crawlable, useful content, descriptive titles, and clear organization.
- [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap): sitemap discovery and accurate metadata; submission does not guarantee crawling or indexing.
- [Canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls): use consistent preferred URLs and redirect duplicates.
- [Structured data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies): markup must match the visible page and cannot guarantee a rich result.
