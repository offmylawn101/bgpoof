import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

// Run manually after changing the licensed example photos or the social card.
// Commit these static assets; serving a page does not need an image renderer.
const original = `data:image/jpeg;base64,${(await readFile('public/example.jpg')).toString('base64')}`;
const cutout = `data:image/png;base64,${(await readFile('public/example-cutout.png')).toString('base64')}`;
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  for (const [name, source] of [
    ['example-preview', original],
    ['example-cutout-preview', cutout],
  ]) {
    for (const width of [640, 1200]) {
      const encoded = await page.evaluate(
        async ({ source, width }) => {
          const image = new Image();
          image.src = source;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = (width * image.height) / image.width;
          canvas
            .getContext('2d')
            .drawImage(image, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/webp', 0.86).split(',')[1];
        },
        { source, width },
      );
      await writeFile(
        `public/${name}-${width}.webp`,
        Buffer.from(encoded, 'base64'),
      );
    }
  }
  await page.setContent(`<!doctype html><html lang="en"><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;background:#f5f7ff;color:#252838;font-family:Arial,sans-serif;width:1200px;height:630px;padding:56px;display:flex;gap:48px;align-items:center}
    .copy{width:490px}.brand{font-size:38px;font-weight:800;letter-spacing:-2px}.brand span{color:#3155ef}h1{font-size:60px;line-height:1.04;letter-spacing:-2px;margin:44px 0 24px}h1 span{color:#3155ef}p{font-size:23px;line-height:1.5;color:#596070}.domain{font-size:19px;color:#3155ef;font-weight:bold}
    .photo{position:relative;width:550px;height:412px;border-radius:20px;overflow:hidden;background-color:white;background-image:conic-gradient(#e6e8f0 25%,transparent 0 50%,#e6e8f0 0 75%,transparent 0);background-size:28px 28px;box-shadow:0 20px 70px #26387220}.photo img{position:absolute;width:100%;height:100%;object-fit:cover}.before{clip-path:inset(0 50% 0 0)}.line{position:absolute;top:0;bottom:0;left:50%;border-left:3px solid white}.label{position:absolute;bottom:20px;background:#ffffffed;border-radius:6px;padding:9px 12px;font-weight:bold;font-size:15px}.left{left:18px}.right{right:18px}
    </style><div class="copy"><div class="brand">bgpoof<span>.</span></div><h1>Remove photo<br><span>backgrounds.</span></h1><p>Free. No account. No watermark.<br>Download your transparent PNG.</p><div class="domain">bgpoof.com</div></div><div class="photo"><img src="${cutout}" alt="Dog cutout"><img class="before" src="${original}" alt="Original dog photo"><div class="line"></div><span class="label left">Original</span><span class="label right">Background removed</span></div></html>`);
  await page.evaluate(() =>
    Promise.all([...document.images].map((image) => image.decode())),
  );
  await page.screenshot({ path: 'public/social-preview.png' });
} finally {
  await browser.close();
}
console.log(
  'Created responsive demo images and the 1200 × 630 social preview.',
);
