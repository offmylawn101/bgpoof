# BG Poof

Photo background removal without accounts, watermarks, or paid download tiers. Upload, drop, or paste a JPG, PNG, or WebP to start processing. An 800 ms reveal shows the transparent PNG; comparison works with a keyboard or touch, and reduced-motion users see the completed result immediately.

## Processing and privacy

The original photo stays in the browser. A browser Worker makes a JPEG copy at quality 0.94, with a maximum long side of 1,024 pixels, and posts it to `/api/remove-background`. That route uses [Cloudflare Images foreground segmentation](https://developers.cloudflare.com/images/optimization/features/#segment) through the `IMAGES` binding. The browser applies the returned transparency mask to the original pixels and encodes a PNG at the source dimensions, preserving existing transparency. A display-sized preview begins the reveal while the full-resolution download finishes encoding. BG Poof does not store uploaded copies or results.

Cloudflare hosts the site, processes the compact photo copy, and collects [cookie-free page-performance metrics](https://developers.cloudflare.com/web-analytics/about/). Those metrics do not include photo contents. Working images remain in browser memory until the user replaces them, clears the result, or closes the page.

Inputs are limited to 25 MB, 25 megapixels, and 8,192 pixels per side. The five-second result target is not guaranteed: network speed, image size, device encoding time, and Cloudflare service load affect latency. Keeping the original dimensions preserves source resolution; fine hair, glass, shadows, and ambiguous subjects can still need editing. BG Poof is independent of remove.bg and Canva and does not promise identical results.

## Run and build

Use Node 22.13 or newer and an authorized Wrangler login for the configured Cloudflare account. Both local development and production-build previews use real Cloudflare Images through a [remote binding](https://developers.cloudflare.com/workers/local-development/). Photo processing requires network access and counts toward that account's Images usage.

```sh
npm install
npx wrangler login
npm run assets
npm run dev -- --host 0.0.0.0 --port 3090
```

`npm run assets` prepares browser assets, dependency notices, and the downloadable source archive. The dev and build commands also run it automatically. For a reproducible installation from the lockfile, use `npm ci`.

```sh
npm run check
npm run build
npm start -- --port 3091
```

The build creates the production Worker and static assets in `dist/`. `npm start` serves that production entry using Wrangler and `wrangler.production.jsonc`. The Vite configuration and production Wrangler configuration both set `images: { binding: "IMAGES", remote: true }`. The API route accesses the binding directly through `cloudflare:workers` during local development and after deployment.

## Cloudflare deployment

Production runs at https://bgpoof.com, with `www` redirected to the apex, as Worker `removebg` in the `agenttransfer` account. Deployment settings live in `wrangler.production.jsonc`. To run or deploy your own copy, update the account and Worker name in both `vite.config.ts` and `wrangler.production.jsonc`, and update the production routes.

The Worker needs these bindings:

- `IMAGES`: the [Cloudflare Images binding](https://developers.cloudflare.com/images/optimization/binding/), configured as `images: { binding: "IMAGES", remote: true }`. Enable the required Images access in the deploying Cloudflare account.
- `REMOVAL_LIMITER`: a [Workers rate-limit binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) configured for 10 requests per 60 seconds, keyed by client IP. Cloudflare enforces these counters per location with eventual consistency; this is an abuse limit, not an exact global quota. People sharing an IP share its allowance.

No secret image API key is required: the Worker accesses Images through its binding. Deployment still requires an authorized Wrangler login or `CLOUDFLARE_API_TOKEN`; credentials do not belong in the repository.

```sh
npm run deploy
```

This runs the type, lint, and API checks, builds the application, and deploys it with the production Wrangler configuration.

## Browser and quality checks

`npm run test:api` runs the API handler tests in Node with mocked Images and rate-limit bindings. These checks do not require a running server or Cloudflare credentials.

`npm test` runs Playwright browser integration tests against `BASE_URL`, which defaults to `http://localhost:3090`. Start the target server first. The Playwright configuration uses Chrome; install a compatible browser before running tests. Tests that process photos require a working Images binding and are subject to the removal rate limit.

The optional quality check accepts local paths to a source photo and a reference transparent PNG of the same uncropped image:

```sh
BGPOOF_QUALITY_ORIGINAL=/absolute/path/photo.jpg \
BGPOOF_QUALITY_REFERENCE=/absolute/path/reference.png \
BASE_URL=http://localhost:3091 \
npm test -- tests/quality.spec.ts
```

The source photo goes through the normal Cloudflare processing flow; the reference stays local. The test checks output dimensions, transparency, and upload behavior, measures cutout and reveal timing, foreground overlap, and alpha error, and saves the downloaded PNG plus `quality-metrics.json` as test artifacts. By default, quality scores are measurements without pass/fail thresholds. Set `BGPOOF_QUALITY_STRICT=1` to require foreground IoU of at least 0.95 and normalized alpha MAE of at most 0.04. `BGPOOF_QUALITY_MIN_IOU` and `BGPOOF_QUALITY_MAX_MAE` optionally set either threshold independently, with values from 0 to 1. Without both image paths, the quality test is skipped. Keep private reference images and generated artifacts out of version control.

## Licenses and credits

Application code: MIT, including the downloadable source archive. React, Lucide, Base UI, and other bundled dependencies retain their own licenses; notices are generated in `public/licenses/dependencies.txt`. Background segmentation is provided by Cloudflare Images through its Workers binding.

The example photo is by [Helena Lopes on Unsplash](https://unsplash.com/fr/photos/golden-retriever-assis-sur-le-sol-au-coucher-du-soleil-w-dZelX6svs), photo `w-dZelX6svs`, under the [Unsplash License](https://unsplash.com/license). Its cutout uses Cloudflare Images and the app's browser compositing. See `/about` and `public/licenses/` for credits.
