import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// The Node test runner owns completion and reports failures for these tests.
import ts from 'typescript';

// Exercise the same standalone module that runs in the photo worker.
const source = await readFile(
  new URL('../lib/refine-mask.ts', import.meta.url),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
}).outputText;
const { refineMask } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

function pixels(width, height, sample) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data.set(sample(x, y), (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

function alphaError(image, expected) {
  let error = 0;
  for (let i = 3; i < image.data.length; i += 4) {
    error += Math.abs(image.data[i] - expected.data[i]);
  }
  return error / (image.width * image.height);
}

void test('constant transparency stays constant even over a textured photograph', () => {
  const photo = pixels(79, 53, (x, y) => [
    (x * 71 + y * 3) % 256,
    (x * 13 + y * 47) % 256,
    (x * 7 + y * 131) % 256,
    255,
  ]);
  for (const alpha of [0, 1, 64, 128, 192, 254, 255]) {
    const mask = pixels(79, 53, () => [37, 91, 153, alpha]);
    const before = mask.data.slice();
    refineMask(mask, photo);
    assert.deepEqual(mask.data, before, `Constant alpha ${alpha} changed`);
  }
});

void test('certain foreground and background remain exact and RGB is untouched', () => {
  const mask = pixels(83, 57, (x, y) => [
    (x * 7) % 256,
    (y * 11) % 256,
    (x + y * 3) % 256,
    x < 29 ? 0 : x > 53 ? 255 : Math.round(((x - 29) / 24) * 255),
  ]);
  const photo = pixels(83, 57, (x, y) => [
    x > 40 ? 230 : 15,
    (x + y) % 256,
    y * 4,
    255,
  ]);
  const before = mask.data.slice();
  const sourceBefore = photo.data.slice();
  refineMask(mask, photo);
  assert.deepEqual(photo.data, sourceBefore, 'The photograph was mutated');
  for (let i = 0; i < before.length; i++) {
    if (i % 4 !== 3 || before[i] === 0 || before[i] === 255) {
      assert.equal(
        mask.data[i],
        before[i],
        `Protected channel changed at ${i}`,
      );
    }
  }
});

void test('a translucent surface between foreground and background keeps its opacity', () => {
  const mask = pixels(73, 41, (x) => [
    43,
    97,
    181,
    x < 20 ? 0 : x > 52 ? 255 : 128,
  ]);
  const photo = pixels(73, 41, (x, y) => [
    (x * 19 + y * 31) % 256,
    (x * 47 + y * 13) % 256,
    (x * 3 + y * 17) % 256,
    255,
  ]);
  const before = mask.data.slice();
  refineMask(mask, photo);
  assert.deepEqual(
    mask.data,
    before,
    'A translucent surface was treated as an uncertain edge',
  );
});

void test('an image-aligned diagonal edge improves without inventing foreground', () => {
  const width = 97;
  const height = 73;
  // Ground truth is a subpixel edge; the model mask has a wider uncertain band.
  const coverage = (x, y, softness) =>
    Math.max(0, Math.min(1, (x - y * 0.62 - 23.4) / softness + 0.5));
  const expected = pixels(width, height, (x, y) => [
    0,
    0,
    0,
    coverage(x, y, 1) * 255,
  ]);
  const photo = pixels(width, height, (x, y) => {
    const value = 20 + coverage(x, y, 1) * 210;
    return [value, value, value, 255];
  });
  const mask = pixels(width, height, (x, y) => [
    71,
    93,
    119,
    coverage(x, y, 3) * 255,
  ]);
  const before = mask.data.slice();
  const initialError = alphaError(mask, expected);
  refineMask(mask, photo);
  assert.ok(
    alphaError(mask, expected) < initialError * 0.9,
    'Image guidance should reduce edge alpha error by at least 10%',
  );
  for (let i = 3; i < before.length; i += 4) {
    if (before[i] === 0 || before[i] === 255) {
      assert.equal(
        mask.data[i],
        before[i],
        'Certain regions must remain unchanged',
      );
    }
  }
});

void test('fine opaque strands and separate transparent gaps survive refinement', () => {
  const width = 93;
  const height = 79;
  const coverage = (x, y) => {
    // Two diagonal strands, with fully transparent space between them.
    const distance = Math.min(
      Math.abs(x - (17 + y * 0.35)),
      Math.abs(x - (41 + y * 0.35)),
    );
    return Math.max(0, Math.min(1, 1.5 - distance));
  };
  const photo = pixels(width, height, (x, y) => {
    const value = 25 + coverage(x, y) * 220;
    return [value, value, value, 255];
  });
  const mask = pixels(width, height, (x, y) => [
    13,
    41,
    83,
    coverage(x, y) * 255,
  ]);
  const before = mask.data.slice();
  refineMask(mask, photo);
  let beforeMass = 0;
  let afterMass = 0;
  for (let i = 3; i < before.length; i += 4) {
    beforeMass += before[i];
    afterMass += mask.data[i];
    if (before[i] === 0)
      assert.equal(mask.data[i], 0, 'Transparent gaps were filled');
    if (before[i] >= 230) {
      assert.ok(mask.data[i] >= 220, 'A solid strand was substantially erased');
    }
  }
  assert.ok(
    afterMass >= beforeMass * 0.95,
    'Thin-strand alpha mass fell by over 5%',
  );
  assert.ok(
    afterMass <= beforeMass * 1.05,
    'Thin-strand alpha mass grew by over 5%',
  );
});

void test('tiny and extreme-aspect images stay valid', () => {
  for (const [width, height] of [
    [1, 1],
    [1, 19],
    [23, 1],
    [2, 3],
  ]) {
    const mask = pixels(width, height, (x, y) => [
      23,
      59,
      101,
      (x * 31 + y * 43) % 256,
    ]);
    const photo = pixels(width, height, (x, y) => [x * 9, y * 13, 71, 255]);
    const before = mask.data.slice();
    refineMask(mask, photo);
    assert.equal(mask.data.length, before.length);
    for (let i = 0; i < before.length; i++) {
      if (i % 4 !== 3 || before[i] === 0 || before[i] === 255) {
        assert.equal(mask.data[i], before[i]);
      }
    }
  }
});
