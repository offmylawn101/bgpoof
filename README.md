# BG Poof

Remove photo backgrounds by uploading, dropping, or pasting a JPG, PNG, or WebP. The hosted app at [bgpoof.com](https://bgpoof.com) has no accounts, watermarks, or paid download tiers. The result frame follows the photo's dimensions; right-click the completed image to copy it, or download the full-resolution transparent PNG. An 800 ms reveal shows the cutout, with immediate display for reduced-motion users.

This repository contains the MIT-licensed application and optional native refinement service. Background segmentation uses Cloudflare Images: its service and model are not bundled. Running your own copy requires your own Cloudflare access and usage allowance. BG Poof is independent of remove.bg and Canva.

## Processing and privacy

The browser retains the original image for final compositing. It uploads one image to `/api/remove-background`, limited to 1,536 pixels per side and 2 MiB. **A PNG already within those limits is uploaded unchanged**, including any embedded metadata, to avoid compression damage to graphics. Other inputs are converted to a resized JPEG at quality 0.94, or 0.8 when needed to fit the upload limit. An uploaded PNG can therefore be the full-resolution original; larger originals remain in the browser while their smaller copies are processed.

The Worker uses the [Cloudflare Images binding](https://developers.cloudflare.com/images/optimization/binding/) for foreground segmentation. If configured, a private server automatically receives the same upload and mask to refine edge transparency and apply bounded color corrections. Its adjustments stay near existing mask boundaries; GrabCut and broad foreground recovery have been removed. Otherwise, or if that service fails or is busy, processing continues with the Cloudflare mask and a browser edge filter. There is no second browser upload.

The browser applies the result to original pixels and existing transparency, then encodes a PNG at the original dimensions. A smaller preview appears first; the progress indicator continues through the actual processing stages until the downloadable PNG is ready. It does not estimate a percentage for operations that provide none. The completed image replaces the preview for native copying.

Application code does not persist uploads or results. The optional native service processes images in memory and does not log their contents. Cloudflare still processes the uploaded image under its own service terms. Browser working images are released when replaced, cleared, or the page closes. Google Analytics is disabled by default in self-hosted copies; deployments can enable their own analytics. Photo contents are not sent to analytics.

Inputs are limited to 25 MB, 25 megapixels, and 8,192 pixels per side. Five-second completion is a target, not a guarantee: network speed, image size, browser encoding, and provider load affect latency. Edge refinement cannot restore large foreground regions missed by Cloudflare. Hair, glass, shadows, and ambiguous subjects can still need editing. See [server/README.md](server/README.md) for the native algorithm and safeguards.

## Run locally

Use Node **22.13 or newer**. Install dependencies from the lockfile:

```sh
git clone https://github.com/offmylawn101/bgpoof.git
cd bgpoof
npm ci
cp wrangler.jsonc wrangler.local.jsonc
cp .env.example .env.local
npx wrangler login
npm run dev -- --host 127.0.0.1 --port 3090
```

Edit `wrangler.local.jsonc` for your Worker name and Cloudflare account. The ignored local file replaces the generic `wrangler.jsonc` configuration when present. The default configuration includes `IMAGES` and `REMOVAL_LIMITER`; it does not need a private server.

Enable Images access in your Cloudflare account. Development and production previews use a real Images remote binding, so removal requires network access and counts toward that account's usage. Review [Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/) and your Workers plan before offering a public instance. The application license does not include hosted processing credits.

Optional public build settings in `.env.local`:

| Setting                     | Purpose                                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `VITE_BGPOOF_SITE_URL`      | Your canonical site origin, for metadata and `www`/HTTP redirects. Leave empty for no forced canonical redirect.                                       |
| `VITE_BGPOOF_GA_ID`         | Your Google Analytics measurement ID. Empty disables Google Analytics.                                                                                 |
| `VITE_BGPOOF_WEB_ANALYTICS` | Set to `true` only when Cloudflare Web Analytics is enabled for your deployment. This controls the privacy disclosure; it does not enable the service. |

These `VITE_` values are public and embedded at build time. Keep credentials in Wrangler authentication or Worker secrets, not in these settings or committed files. Changes require a rebuild.

## Build and deploy

```sh
npm run check
npm run build
npm start -- --port 3091
```

Builds prepare browser assets and dependency notices automatically, write the application to `dist/`, and generate ignored `wrangler.production.jsonc` from the selected source configuration. `npm start` previews that built Worker. Edit `wrangler.jsonc` or your local override, not the generated production file.

Installing dependencies and building do not require Cloudflare credentials. Real image removal and deployment do.

To deploy, set your Worker name and, if needed, `account_id` and custom-domain `routes` in `wrangler.local.jsonc`. Use an authorized Wrangler login or `CLOUDFLARE_API_TOKEN`, then run:

```sh
npm run deploy
```

This runs type, lint, API, and mask checks, builds, and deploys with the generated configuration. Native service tests are separate because that service is optional.

The required bindings are:

- `IMAGES`: `images: { "binding": "IMAGES", "remote": true }`, using your Cloudflare Images access.
- `REMOVAL_LIMITER`: 10 removal requests per 60 seconds, keyed by client IP. People sharing an IP share the allowance. Cloudflare's [rate-limit counters](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) operate per location with eventual consistency; this is not an exact global quota.

No separate image API key is needed; Images is accessed through the Worker binding.

### Optional native refinement

Cloudflare-only removal works without Python, PM2, a tunnel, or `GRABCUT_SECRET`. For automatic native edge matting, provision a Linux server with Python, PM2, and `cloudflared`, then install:

```sh
python3 -m venv .venv-grabcut
.venv-grabcut/bin/pip install -r server/requirements.txt
npm run test:grabcut
```

The `GRABCUT` binding, secret, file paths, PM2 names, and test command retain their historical names for existing installations. They now refer to edge matting only; the GrabCut algorithm has been removed.

Create a private Cloudflare Tunnel and [Workers VPC service](https://developers.cloudflare.com/workers-vpc/configuration/vpc-services/) targeting the server's `127.0.0.1:5137`. Add its binding to `wrangler.local.jsonc`:

```json
"vpc_services": [
  { "binding": "GRABCUT", "service_id": "YOUR_VPC_SERVICE_ID", "remote": true }
]
```

Provision `.secrets/grabcut-key` with a random token of at least 32 characters, and `.secrets/tunnel-token` with your tunnel credential. Protect both files with mode 600. After building to refresh the generated configuration, set the same service token as a Worker secret and start the services:

```sh
npm run build
npx wrangler secret put GRABCUT_SECRET --config wrangler.production.jsonc < .secrets/grabcut-key
pm2 start ecosystem.config.cjs
pm2 save
npm run deploy
```

The PM2 file starts only the edge-matting service and its QUIC tunnel connector. Adjust its `/usr/local/bin/cloudflared` path if your installation differs. Local development and previews also need `GRABCUT_SECRET` in ignored `.dev.vars`; their remote VPC binding uses your private service. Service changes require restarting `bgpoof-grabcut`; application changes require a Worker deployment. See [server/README.md](server/README.md) for direct startup, authentication, protocol, and resource limits.

## Tests and quality measurements

```sh
npm run test:api
npm run test:mask
```

These Node checks use mocked bindings and synthetic image data; they need neither Cloudflare credentials nor a running server. `npm run test:grabcut` additionally checks edge matting, foreground preservation, and process limits in the optional Python environment.

GitHub Actions runs the application checks and build on Node 22, plus native service tests on Python 3.13, without deployment credentials.

`npm test` runs Playwright browser tests against `BASE_URL`, defaulting to `http://localhost:3090`. Start the app first and install the configured browser with `npx playwright install chrome`. Tests that actually remove photos need a working Images binding and count toward its rate limit. Set `BGPOOF_TEST_GA_ID` to the target site's measurement ID when testing an analytics-enabled deployment; leave it unset for the default analytics-free build. The bundled portrait fixture and its rights are documented in [tests/ASSETS.md](tests/ASSETS.md).

The optional quality check accepts local paths to a source photo and a reference transparent PNG of the same uncropped image:

```sh
BGPOOF_QUALITY_ORIGINAL=/absolute/path/photo.jpg \
BGPOOF_QUALITY_REFERENCE=/absolute/path/reference.png \
BASE_URL=http://localhost:3091 \
npm test -- tests/quality.spec.ts
```

The source follows the normal processing flow; the reference stays local. The test validates dimensions, transparency, and upload behavior, measures cutout/reveal timing, foreground overlap, and alpha error, and saves the PNG and `quality-metrics.json` as artifacts. Without both image paths, it skips.

- `BGPOOF_REQUIRE_MATTING=1` requires successful edge matting and its recognized matte/color protocol in the complete removal pipeline.
- `BGPOOF_REQUIRE_GRABCUT=1` is a compatibility alias for that check; it does not enable or require the removed GrabCut algorithm.
- `BGPOOF_QUALITY_STRICT=1` requires foreground IoU of at least 0.95 and normalized alpha MAE of at most 0.04.
- `BGPOOF_QUALITY_MIN_IOU` and `BGPOOF_QUALITY_MAX_MAE` set individual thresholds between 0 and 1. Otherwise scores are measurements without pass/fail thresholds.

Keep private reference images and generated artifacts outside version control. See [CONTRIBUTING.md](CONTRIBUTING.md) for submitting fixes.

## Licenses and credits

Application and native service source: [MIT](LICENSE). Dependencies retain their own licenses; browser notices are generated in `public/licenses/dependencies.txt`. OpenCV and NumPy notices accompany the installed Python packages. Cloudflare's segmentation service remains a separate hosted dependency.

The example dog photo is by [Helena Lopes on Unsplash](https://unsplash.com/fr/photos/golden-retriever-assis-sur-le-sol-au-coucher-du-soleil-w-dZelX6svs), photo `w-dZelX6svs`, under the [Unsplash License](https://unsplash.com/license). Its cutout uses Cloudflare Images and browser compositing. The public-domain test portrait has separate attribution in [tests/ASSETS.md](tests/ASSETS.md).

The public Git history excludes retired local model files and a previous test fixture whose redistribution rights were undocumented.
