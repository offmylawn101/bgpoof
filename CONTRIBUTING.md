# Contributing to BG Poof

Issues and pull requests are welcome at [offmylawn101/bgpoof](https://github.com/offmylawn101/bgpoof). Follow the [README](README.md) to run the app with your own Cloudflare account. The default deployment does not need the optional Python refinement service.

For a bug report, include the browser/device, reproduction steps, expected behavior, and actual result. For removal-quality problems, include both the original and output only when you have permission to share them publicly. A synthetic reproduction is useful when the photo is private. Record whether native refinement was enabled and any measured processing time.

Keep changes focused and preserve upload/paste/drop behavior, original image dimensions and alpha, cancellation, native copying, and completion only after the final PNG is ready. Explain quality and latency tradeoffs with measurements when changing the image pipeline.

Before submitting:

```sh
npm ci
npm run check
npm run test:api
npm run test:mask
npm run build
```

For browser changes, start the built app and run the relevant Playwright tests with `BASE_URL=http://localhost:3091 npm test`. Real removal tests use your Cloudflare account and its rate limit. For native changes, install `server/requirements.txt` in `.venv-grabcut` and run `npm run test:grabcut`. Include the checks and results in your pull request.

GitHub Actions checks application code on Node 22 and the optional service on Python 3.13. These jobs do not deploy or need Cloudflare credentials.

Commit source and necessary fixtures, with documented redistribution rights. Leave credentials, personal deployment configuration, private photos, generated assets, and test outputs untracked. New code is contributed under the repository's [MIT license](LICENSE); third-party assets keep their own licenses and attribution.
