# Private automatic foreground recovery

This loopback service runs one 512-pixel, one-iteration GrabCut pass after
Cloudflare background removal. It uses Cloudflare's confident foreground as
fixed seeds and dark-alpha border pixels as background seeds. Other pixels
start as probable foreground. The result keeps the maximum of the recovered
alpha and Cloudflare's original working-resolution alpha. It can recover
missing foreground, but can also restore unwanted background; it is a
foreground recovery heuristic, not another semantic model.

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
alpha. **RGB is constant white: callers must apply the alpha to their original
photo.** `X-Bgpoof-Refinement` is `recovered` or `unchanged`; `Server-Timing`
reports native processing and encoding time. The caller should fall back to
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
