type Pixels = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

const radius = 2;
const colorWeight = Float32Array.from({ length: 256 }, (_, difference) =>
  Math.exp(-(difference * difference) / (2 * 32 * 32)),
);
const spatialWeight = Float32Array.from({ length: 25 }, (_, index) => {
  const x = (index % 5) - radius;
  const y = Math.floor(index / 5) - radius;
  return Math.exp(-(x * x + y * y) / 4);
});

// Use the photo's colors to refine uncertain boundaries. Keep hard mask pixels
// and interior translucency intact; this must not become a global opacity boost.
export function refineMask(mask: Pixels, photo: Pixels): void {
  const { width, height, data } = mask;
  if (width !== photo.width || height !== photo.height)
    throw new Error('The photo and transparency mask must have the same size.');

  const alpha = new Uint8Array(width * height);
  let uncertain = 0;
  for (let i = 0; i < alpha.length; i++) {
    alpha[i] = data[i * 4 + 3];
    if (alpha[i] > 16 && alpha[i] < 239) uncertain++;
  }
  // Bound work for heavily translucent/noisy masks. Preserve their existing
  // alpha rather than run a costly filter across most of the photo.
  if (uncertain > 250_000) return;

  const guide = photo.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const current = alpha[index];
      if (current <= 16 || current >= 239) continue;
      const left = Math.max(0, x - radius);
      const right = Math.min(width - 1, x + radius);
      const top = Math.max(0, y - radius);
      const bottom = Math.min(height - 1, y + radius);
      let low = current;
      let high = current;
      for (let yy = top; yy <= bottom; yy++) {
        for (let xx = left; xx <= right; xx++) {
          const value = alpha[yy * width + xx];
          low = Math.min(low, value);
          high = Math.max(high, value);
        }
      }
      if (low > 16 || high < 239) continue;

      const pixel = index * 4;
      let total = 0;
      let weightSum = 0;
      for (let yy = top; yy <= bottom; yy++) {
        for (let xx = left; xx <= right; xx++) {
          const neighbor = yy * width + xx;
          const offset = neighbor * 4;
          const weight =
            spatialWeight[(yy - y + radius) * 5 + xx - x + radius] *
            colorWeight[Math.abs(guide[pixel] - guide[offset])] *
            colorWeight[Math.abs(guide[pixel + 1] - guide[offset + 1])] *
            colorWeight[Math.abs(guide[pixel + 2] - guide[offset + 2])];
          total += alpha[neighbor] * weight;
          weightSum += weight;
        }
      }
      data[pixel + 3] = Math.max(
        1,
        current - 24,
        Math.min(254, current + 24, Math.round(total / weightSum)),
      );
    }
  }
}
