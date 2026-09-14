# BG Poof

Photo background removal without accounts, watermarks, or paid download tiers. Upload, drop, or paste a JPG, PNG, or WebP to start processing. An 800 ms reveal shows the cutout, and reduced-motion users see it immediately. The result frame follows the uploaded photo’s aspect ratio. Right-click the completed image to copy its full-resolution PNG, or use Show original to compare. The homepage example retains its keyboard and touch slider.

## Processing and privacy

The full-resolution original photo stays in the browser. A browser Worker makes a JPEG copy at quality 0.94, with a maximum long side of 1,536 pixels, and posts it to `/api/remove-background`. Unusually detailed copies use stronger compression to stay within the 2 MiB upload budget. That route uses [Cloudflare Images foreground segmentation](https://developers.cloudflare.com/images/optimization/features/#segment) through the `IMAGES` binding. The route then automatically sends that compact source and mask through a private connection to this server for a bounded GrabCut recovery pass and edge matting. No extra click or browser upload is needed. The server estimates edge transparency and remaining background color. The browser applies bounded color corrections to uncertain edges in the original photo, then applies the mask and encodes a PNG at the source dimensions, preserving existing transparency and full-resolution texture. A display-sized preview begins the reveal while the full-resolution download finishes encoding, then the displayed image switches to the full-resolution PNG for native copying. BG Poof does not store uploaded copies or results.

GrabCut uses Cloudflare’s confident foreground and a four-pixel band of low-alpha background seeds at the edge of its 512-pixel working image. It can recover details such as foil, but may also restore unwanted background. Soft outer edges and spatially supported translucent areas are protected from binary recovery before matting. The following matting pass estimates local foreground/background colors near uncertain boundaries and solves their color mixture for alpha. It declines low-contrast or poorly supported estimates and leaves interior translucency alone.

The private PNG carries the refined alpha and versioned RGB corrections. The browser applies only recognized corrections, bounded to 64 channel levels, in sparse tiles before masking. It keeps opaque cores and already-transparent source pixels intact. Reading too much of a very large or complex image skips color correction to bound browser cost. If the private service is busy, unavailable, or exceeds its deadline, the route returns the Cloudflare mask and the browser uses its existing bounded edge filter. No extra Cloudflare transformation or AI request is made.

Cloudflare hosts the site, segments the compact photo copy, and collects [cookie-free page-performance metrics](https://developers.cloudflare.com/web-analytics/about/). Our private server processes that copy transiently in memory. Google Analytics measures site usage and may use cookies. Neither analytics service receives photo contents. Working images remain in browser memory until the user replaces them, clears the result, or closes the page.

Inputs are limited to 25 MB, 25 megapixels, and 8,192 pixels per side. The five-second result target is not guaranteed: network speed, image size, device encoding time, Cloudflare service load, and server recovery time affect latency. Keeping the original dimensions preserves source resolution; fine hair, glass, shadows, and ambiguous subjects can still need editing. BG Poof is independent of remove.bg and Canva and does not promise identical results.

## Run and build

Use Node 22.13 or newer and an authorized Wrangler login for the configured Cloudflare account. Both local development and production-build previews use real Cloudflare Images through a [remote binding](https://developers.cloudflare.com/workers/local-development/). Photo processing requires network access and counts toward that account's Images usage.

```sh
npm install
npx wrangler login
npm run assets
npm run dev -- --host 0.0.0.0 --port 3090
```

`npm run assets` prepares browser assets and dependency notices. The dev and build commands also run it automatically. Application source archives are not published. For a reproducible installation from the lockfile, use `npm ci`.

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
- `GRABCUT`: a [Workers VPC service binding](https://developers.cloudflare.com/workers-vpc/configuration/vpc-services/) connected through the `bgpoof-inference` tunnel to `127.0.0.1:5137`.
- `GRABCUT_SECRET`: a Worker secret matching the private service token.

No secret image API key is required: the Worker accesses Images through its binding. Deployment still requires an authorized Wrangler login or `CLOUDFLARE_API_TOKEN`; credentials do not belong in the repository.

```sh
npm run deploy
```

This runs the type, lint, API, mask-refinement, and native service checks, builds the application, and deploys it with the production Wrangler configuration.

### Private recovery service

Install the isolated native environment before running service checks or deployment:

```sh
python3 -m venv .venv-grabcut
.venv-grabcut/bin/pip install -r server/requirements.txt
```

Provision `.secrets/grabcut-key` with a random token of at least 32 characters and `.secrets/tunnel-token` with the private tunnel credential; protect both files with mode 600. Set the same recovery token as the Worker secret:

```sh
npx wrangler secret put GRABCUT_SECRET --config wrangler.production.jsonc < .secrets/grabcut-key
pm2 start ecosystem.config.cjs
pm2 save
```

The PM2 configuration runs only the recovery service and its QUIC tunnel connector. Local previews also need `GRABCUT_SECRET` in ignored `.dev.vars`; the configured remote VPC binding uses the same service. See [server/README.md](server/README.md) for the wire protocol and resource limits. Service changes require restarting `bgpoof-grabcut`; edge or UI changes require the Worker deployment.

## Browser and quality checks

`npm run test:api` runs the API handler and private recovery integration tests in Node with mocked bindings, including timeout, cancellation, invalid-output, and overload fallbacks. These checks do not require a running server or Cloudflare credentials.

`npm run test:grabcut` checks native recovery and matting, including known soft-edge colors, protected foreground, unsupported mixtures, and process limits.

`npm run test:mask` checks the fallback image-guided edge refinement against synthetic reference edges, thin strands, and translucent masks without network access.

`npm test` runs Playwright browser integration tests against `BASE_URL`, which defaults to `http://localhost:3090`. Start the target server first. The Playwright configuration uses Chrome; install a compatible browser before running tests. Tests that process photos require a working Images binding and are subject to the removal rate limit.

The optional quality check accepts local paths to a source photo and a reference transparent PNG of the same uncropped image:

```sh
BGPOOF_QUALITY_ORIGINAL=/absolute/path/photo.jpg \
BGPOOF_QUALITY_REFERENCE=/absolute/path/reference.png \
BASE_URL=http://localhost:3091 \
npm test -- tests/quality.spec.ts
```

Set `BGPOOF_REQUIRE_GRABCUT=1` to require the automatic server stage to succeed and `BGPOOF_REQUIRE_MATTING=1` to require the refined matte/color protocol. Browser tests also verify neutral colors after PNG decoding, color-fringe correction, original transparency, and full-resolution texture. The source photo goes through the normal Cloudflare and GrabCut processing flow; the reference stays local. The test checks output dimensions, transparency, and upload behavior, measures cutout and reveal timing, foreground overlap, and alpha error, and saves the downloaded PNG plus `quality-metrics.json` as test artifacts. By default, quality scores are measurements without pass/fail thresholds. Set `BGPOOF_QUALITY_STRICT=1` to require foreground IoU of at least 0.95 and normalized alpha MAE of at most 0.04. `BGPOOF_QUALITY_MIN_IOU` and `BGPOOF_QUALITY_MAX_MAE` optionally set either threshold independently, with values from 0 to 1. Without both image paths, the quality test is skipped. Keep private reference images and generated artifacts out of version control.

## Licenses and credits

Application code: MIT. React, Lucide, Base UI, and other bundled dependencies retain their own licenses; notices are generated in `public/licenses/dependencies.txt`. Background segmentation is provided by Cloudflare Images through its Workers binding. Server foreground recovery uses OpenCV GrabCut; OpenCV and NumPy retain their respective licenses in the installed Python packages.

The example photo is by [Helena Lopes on Unsplash](https://unsplash.com/fr/photos/golden-retriever-assis-sur-le-sol-au-coucher-du-soleil-w-dZelX6svs), photo `w-dZelX6svs`, under the [Unsplash License](https://unsplash.com/license). Its cutout uses Cloudflare Images and the app's browser compositing. See `/about` and `public/licenses/` for credits.
