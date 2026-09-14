import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Exercise the built Worker without attaching Images, VPC, rate-limit, or any
// other production bindings. Running from a temporary directory also keeps
// Wrangler from loading the project's .dev.vars and .env files.
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(projectRoot, 'wrangler.production.jsonc');
const parsed = ts.parseConfigFileTextToJson(
  sourcePath,
  await readFile(sourcePath, 'utf8'),
);
if (parsed.error)
  throw new Error('Build first: wrangler.production.jsonc is invalid.');
const source = parsed.config;
if (!source.main || !source.assets?.directory || !source.compatibility_date) {
  throw new Error(
    'Build first: the production Worker configuration is incomplete.',
  );
}
const port = Number(process.env.BGPOOF_SEO_PORT || 3092);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('BGPOOF_SEO_PORT must be an integer between 1024 and 65535.');
}

const temporaryRoot = await mkdtemp(resolve(tmpdir(), 'bgpoof-seo-'));
const configPath = resolve(temporaryRoot, 'wrangler.json');
let child;
const stop = (signal) => child?.kill(signal);
const interrupt = () => stop('SIGINT');
const terminate = () => stop('SIGTERM');

try {
  await writeFile(
    configPath,
    JSON.stringify(
      {
        name: 'bgpoof-seo-preview',
        main: resolve(projectRoot, source.main),
        no_bundle: true,
        rules: source.rules,
        compatibility_date: source.compatibility_date,
        compatibility_flags: source.compatibility_flags,
        assets: { directory: resolve(projectRoot, source.assets.directory) },
      },
      null,
      2,
    ),
  );

  const environment = Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => !/^(?:CLOUDFLARE_|CF_|WRANGLER_)/.test(name),
    ),
  );
  child = spawn(
    process.execPath,
    [
      resolve(projectRoot, 'node_modules/wrangler/bin/wrangler.js'),
      'dev',
      '--config',
      configPath,
      '--local',
      '--ip',
      '127.0.0.1',
      '--port',
      String(port),
      '--inspector-port',
      '0',
      '--persist-to',
      resolve(temporaryRoot, 'state'),
      '--show-interactive-dev-session=false',
    ],
    {
      cwd: temporaryRoot,
      env: {
        ...environment,
        CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
        WRANGLER_SEND_METRICS: 'false',
        CI: 'true',
      },
      stdio: ['ignore', 'inherit', 'inherit'],
    },
  );
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  const { code, signal } = await new Promise((resolveExit, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolveExit({ code, signal }));
  });
  process.exitCode =
    code ?? (signal === 'SIGINT' || signal === 'SIGTERM' ? 0 : 1);
} finally {
  process.off('SIGINT', interrupt);
  process.off('SIGTERM', terminate);
  await rm(temporaryRoot, { recursive: true, force: true });
}
