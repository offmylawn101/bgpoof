import ts from 'typescript';
import { readFile, writeFile, readdir, rm } from 'node:fs/promises';
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
// Remove the archive left by older builds; application source is not published.
await rm('public/source/bgpoof-source.tar.gz', { force: true });
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
]) {
  const root = `node_modules/${name}`;
  for (const file of await readdir(root))
    if (/^licen[cs]e(\.|$)/i.test(file))
      notices.push(
        `\n=== ${name} ===\n` + (await readFile(`${root}/${file}`, 'utf8')),
      );
}
await writeFile('public/licenses/dependencies.txt', notices.join('\n'));
console.log('Prepared photo Worker and dependency notices.');
