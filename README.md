# BG Poof

Account-free, browser-only photo background removal. Upload, drop anywhere, or paste a JPG/PNG/WebP. Processing automatically starts in a dedicated Worker; a two-second right-to-left cubic wipe reveals a transparent full-resolution PNG. Comparison is keyboard and touch accessible. No photo API, application credentials, tracking cookies, or image storage. Cloudflare automatically collects cookie-free page-performance metrics on the custom domain; these do not include photo contents.

## Run

Node 22.13+ required.

```sh
npm ci
npm run model:download # only necessary when model parts are absent (source archive)
npm run assets
npm run dev -- --host 0.0.0.0 --port 3090
```

`npm run build` creates the production Worker and assets. `npm start` serves that production build with Wrangler. `npm run check` typechecks/lints. `npm test` runs browser integration tests against `BASE_URL` (default http://localhost:3090).

The source archive intentionally excludes generated runtime binaries, model chunks, and deployment IDs; scripts reproduce them with pinned versions and SHA-256 verification. The included example cutout was generated from an actual browser run of this engine. The app has no dependency on any hosting account for local operation.

## Runtime and limits

ONNX Runtime Web 1.21.0 and IMG.LY IS-Net fp16, pinned model revision `440dea96dd4a3b06bbbf5abec3e26569dd7ec49f`. Model SHA-256 `2eb4b5dda7ec41c617e59706e5aafa1f978c9a5f983d2518d9f0ae4d6eb04f20`. All model and runtime resources are self-hosted. Split model parts stay below Cloudflare’s per-asset size limit. Model download is about 88 MB plus 13 MB WASM; checksummed parts are cached using Cache Storage where available. Cache failures do not prevent processing. One Worker/session at a time, terminated on cancellation/error, retained for 2 minutes between photos. Processing and encoding stay off the main thread. WASM works without WebGPU; two threads only when cross-origin isolation is available, otherwise one.

25 MB / 25 megapixels / 8192 pixels per side. Original dimensions and existing alpha are retained. Hair, transparent materials, low contrast and ambiguous subjects remain model limitations. No claim of proprietary remove.bg model equivalence. Reduced-motion users get the completed result immediately. Decode orientation follows browser createImageBitmap behavior.

## Licenses

Application: MIT. ONNX Runtime: MIT. IMG.LY's standalone model card marks the converted model MIT; preserve model attribution and the DIS upstream Apache-2.0 notice. No code from the AGPL background-removal wrapper is used. The sample photo is by Helena Lopes, Unsplash photo `w-dZelX6svs`, under the Unsplash License. See `/about` and `public/licenses/`.

## Cloudflare deployment

The main address is https://bgpoof.com; www redirects to the apex. Production is deployed directly to the `agenttransfer` account as Worker `removebg`, using `wrangler.production.jsonc`. Run `npm run deploy` with an authorized Wrangler login or `CLOUDFLARE_API_TOKEN` in the environment. No credential is stored in this repository. The production entry adds cross-origin isolation headers to HTML while `_headers` covers static assets, allowing two WASM threads on supported browsers. `npm start -- --port 3091` serves the exact production entry locally.
