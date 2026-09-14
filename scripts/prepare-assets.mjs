import ts from 'typescript';
import { readFile, writeFile, readdir, rm } from 'node:fs/promises';
// Compile the Worker modules separately so dev transforms cannot inject DOM-only code.
for (const [source, output] of [
  ['lib/removal.worker.ts', 'public/removal.worker.mjs'],
  ['lib/refine-mask.ts', 'public/refine-mask.js'],
  ['lib/edge-colors.ts', 'public/edge-colors.js'],
])
  await writeFile(
    output,
    ts.transpileModule(await readFile(source, 'utf8'), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    }).outputText,
  );
// Remove the archive left by older builds; the site does not serve source archives.
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
