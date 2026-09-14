import ts from 'typescript';
import {
  mkdir,
  copyFile,
  readFile,
  writeFile,
  readdir,
} from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
// Compile this self-contained Worker separately so dev transforms cannot inject DOM-only code.
const worker = await readFile('lib/removal.worker.ts', 'utf8');
await writeFile(
  'public/removal.worker.mjs',
  ts.transpileModule(worker, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText,
);
const destination = 'public/runtime/ort-1.21.0';
await mkdir(destination, { recursive: true });
for (const filename of [
  'ort.wasm.min.mjs',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.wasm',
]) {
  await copyFile(
    `node_modules/onnxruntime-web/dist/${filename}`,
    `${destination}/${filename}`,
  );
}
await mkdir('public/source', { recursive: true });
const notices = [];
for (const name of [
  'react',
  'react-dom',
  'scheduler',
  'lucide-react',
  '@base-ui/react',
  '@base-ui/utils',
  '@floating-ui/react-dom',
  '@floating-ui/dom',
  '@floating-ui/core',
  '@floating-ui/utils',
  'clsx',
  'class-variance-authority',
  'tailwind-merge',
  'onnxruntime-common',
  'onnxruntime-web',
]) {
  const root = `node_modules/${name}`;
  for (const file of await readdir(root))
    if (/^licen[cs]e(\.|$)/i.test(file))
      notices.push(
        `\n=== ${name} ===\n` + (await readFile(`${root}/${file}`, 'utf8')),
      );
}
await writeFile('public/licenses/dependencies.txt', notices.join('\n'));
const files = [
  'app',
  'lib',
  'components',
  'hooks',
  'scripts',
  'tests',
  'public/icon.svg',
  'public/example.jpg',
  'public/example-cutout.png',
  'public/_headers',
  'public/licenses',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vite.config.ts',
  'wrangler.production.jsonc',
  'next.config.ts',
  'components.json',
  'playwright.config.ts',
  '.oxlintrc.json',
  '.oxfmtrc.json',
  '.gitignore',
  'README.md',
  'LICENSE',
];
execFileSync('tar', ['-czf', 'public/source/cutout-source.tar.gz', ...files]);
console.log('Prepared matching ONNX runtime assets and downloadable source.');
