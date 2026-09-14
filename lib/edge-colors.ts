type Pixels = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

const tileSide = 256;
const maximumReadback = 8_000_000;

// Apply only the server's bounded edge-color delta. Reading sparse tiles keeps
// the original-resolution texture and avoids copying a whole 25 MP canvas.
export function applyEdgeColors(
  context: OffscreenCanvasRenderingContext2D,
  matte: Pixels,
): number {
  const width = context.canvas.width;
  const height = context.canvas.height;
  const scaleX = width / matte.width;
  const scaleY = height / matte.height;
  const columns = Math.ceil(width / tileSide);
  const rows = Math.ceil(height / tileSide);
  const tiles = new Uint8Array(columns * rows);
  const delta = new Int8Array(matte.width * matte.height * 3);
  let active = 0;
  for (let i = 0; i < matte.width * matte.height; i++) {
    const pixel = i * 4;
    const alpha = matte.data[pixel + 3];
    if (alpha < 16 || alpha >= 239) continue;
    // PNG colors pass through an 8-bit premultiplied canvas. Account for its
    // neutral-value rounding (128 can become 135 at alpha 17).
    const neutral = Math.round((Math.round((128 * alpha) / 255) * 255) / alpha);
    const red = Math.max(-64, Math.min(64, matte.data[pixel] - neutral));
    const green = Math.max(-64, Math.min(64, matte.data[pixel + 1] - neutral));
    const blue = Math.max(-64, Math.min(64, matte.data[pixel + 2] - neutral));
    if (Math.max(Math.abs(red), Math.abs(green), Math.abs(blue)) <= 3) continue;
    if (++active > 250_000) return 0;
    delta[i * 3] = red;
    delta[i * 3 + 1] = green;
    delta[i * 3 + 2] = blue;
    const x = i % matte.width;
    const y = Math.floor(i / matte.width);
    const left = Math.max(0, Math.floor(((x - 1) * scaleX) / tileSide));
    const right = Math.min(
      columns - 1,
      Math.floor(((x + 2) * scaleX) / tileSide),
    );
    const top = Math.max(0, Math.floor(((y - 1) * scaleY) / tileSide));
    const bottom = Math.min(
      rows - 1,
      Math.floor(((y + 2) * scaleY) / tileSide),
    );
    for (let yy = top; yy <= bottom; yy++) {
      for (let xx = left; xx <= right; xx++) tiles[yy * columns + xx] = 1;
    }
  }
  if (!active) return 0;
  let readback = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (!tiles[i]) continue;
    readback +=
      Math.min(tileSide, width - (i % columns) * tileSide) *
      Math.min(tileSide, height - Math.floor(i / columns) * tileSide);
  }
  if (readback > maximumReadback) return 0;

  let changed = 0;
  for (let tile = 0; tile < tiles.length; tile++) {
    if (!tiles[tile]) continue;
    const left = (tile % columns) * tileSide;
    const top = Math.floor(tile / columns) * tileSide;
    const w = Math.min(tileSide, width - left);
    const h = Math.min(tileSide, height - top);
    const original = context.getImageData(left, top, w, h);
    for (let y = 0; y < h; y++) {
      const yy = Math.max(
        0,
        Math.min(matte.height - 1, (top + y + 0.5) / scaleY - 0.5),
      );
      const y0 = Math.floor(yy);
      const y1 = Math.min(matte.height - 1, y0 + 1);
      const fy = yy - y0;
      for (let x = 0; x < w; x++) {
        const pixel = (y * w + x) * 4;
        // A transparent source was white-backed for inference. Its original
        // colors and alpha must survive without that backing being subtracted.
        if (original.data[pixel + 3] !== 255) continue;
        const xx = Math.max(
          0,
          Math.min(matte.width - 1, (left + x + 0.5) / scaleX - 0.5),
        );
        const x0 = Math.floor(xx);
        const x1 = Math.min(matte.width - 1, x0 + 1);
        const fx = xx - x0;
        const nearestAlpha =
          matte.data[(Math.round(yy) * matte.width + Math.round(xx)) * 4 + 3];
        if (nearestAlpha < 16 || nearestAlpha >= 239) continue;
        const a = (y0 * matte.width + x0) * 3;
        const b = (y0 * matte.width + x1) * 3;
        const c = (y1 * matte.width + x0) * 3;
        const d = (y1 * matte.width + x1) * 3;
        let edited = false;
        for (let channel = 0; channel < 3; channel++) {
          const correction = Math.round(
            (delta[a + channel] * (1 - fx) + delta[b + channel] * fx) *
              (1 - fy) +
              (delta[c + channel] * (1 - fx) + delta[d + channel] * fx) * fy,
          );
          if (correction) {
            original.data[pixel + channel] += correction;
            edited = true;
          }
        }
        if (edited) changed++;
      }
    }
    context.putImageData(original, left, top);
  }
  return changed;
}
