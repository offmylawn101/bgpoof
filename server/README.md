# Private automatic foreground recovery

This loopback service runs one 512-pixel, one-iteration GrabCut pass after
Cloudflare background removal. It uses Cloudflare's confident foreground as
fixed seeds and low-alpha pixels in a four-pixel border as background seeds.
Other pixels start as probable foreground. Recovery adds missing foreground
while preserving Cloudflare's soft alpha (17–238) at outer boundaries and
spatially supported translucent interiors. Thin uncertain seams inside a
recovered object stay repaired; a coarse binary mask does not make the
supported hair or translucent areas opaque.

At the original working resolution, a narrow automatic trimap then estimates
edge opacity and removes background color contamination. Eroded confident
foreground/background supply nearby local colors. The observed pixel is
projected onto that color mixture to estimate alpha; weak contrast or a poor
reconstruction fit leaves the existing matte unchanged. A regularized
foreground-color estimate avoids amplifying noise at low alpha. Both kinds
of evidence must be within 12 pixels; opaque cores, unsupported boundaries,
and interior translucency remain untouched. Work is capped at 250,000
candidate edge pixels; no disconnected foreground components are pruned.

These passes can recover missing foreground and improve soft edges, but can
also restore unwanted background. They do not add another semantic model.

Install `server/requirements.txt` in an isolated Python environment. Run:

```sh
BGPOOF_SECRET_FILE=/protected/path/token /path/to/venv/bin/python server/grabcut.py
```

The token must contain at least 32 characters. The service binds only
`127.0.0.1:5137`. Both routes require `Authorization: Bearer <token>`:

- `GET /health` returns `{"ok":true}`.
- `POST /refine` accepts `application/octet-stream` with an explicit
  `Content-Length`: four bytes containing the source byte length in big-endian
  order, the original working-image JPEG/PNG/WebP bytes, then the Cloudflare
  cutout PNG bytes. Source size is at most 2 MiB; the complete envelope is at
  most 14 MiB. Both images must have equal dimensions, at most 1536 pixels on
  either side and 2.4 million pixels. The cutout must be 8-bit RGBA PNG.

Successful responses are `image/png`, with the same dimensions and refined
alpha, and `X-Bgpoof-Matte-Format: delta-rgb-v1`. **RGB stores signed color
corrections, not a photograph:** subtract 128 from each channel to obtain the
foreground-color correction, bounded to ±64. Neutral RGB is 128. Corrections
are zero outside supported soft boundaries (alpha 17–238). Callers must apply
the alpha to their original photo and may add the correction to its original
color channels only when this version header is recognized. Preserve the
original source alpha. `X-Bgpoof-Refinement` reports GrabCut's `recovered` or
`unchanged` status; `Server-Timing` reports all native processing and encoding
time. The caller should fall back to
Cloudflare's result on any service error. Busy returns 503; timeout returns
504; invalid images return 400.

One persistent native process handles one request at a time, with no job
queue. A four-second wall-clock deadline kills an overlong native process;
the next request starts a replacement. Native memory is limited to 1 GiB,
OpenCV uses one CPU thread, and core dumps are disabled. Four concurrent HTTP
connections and four-second upload deadlines bound request handling. Image
headers are checked before decoding. The service uses fixed shared-memory
buffers, clears them after each request, and stores or logs no images. Keep
it behind the authenticated Cloudflare private connection; it is not a
public upload endpoint.

Run validations with the same environment:

```sh
/path/to/venv/bin/python -m unittest discover -s server -v
```
