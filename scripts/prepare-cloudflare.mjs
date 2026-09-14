import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { loadEnv } from 'vite';

const configPath = existsSync('wrangler.local.jsonc')
  ? 'wrangler.local.jsonc'
  : 'wrangler.jsonc';
const parsed = ts.parseConfigFileTextToJson(
  configPath,
  await readFile(configPath, 'utf8'),
);
if (parsed.error) throw new Error(`Invalid JSONC in ${configPath}`);
await writeFile(
  'wrangler.production.jsonc',
  JSON.stringify(
    {
      ...parsed.config,
      main: 'dist/server/cloudflare-entry.js',
      no_bundle: true,
      rules: [{ type: 'ESModule', globs: ['**/*.js', '**/*.mjs'] }],
      assets: { directory: 'dist/client' },
    },
    null,
    2,
  ) + '\n',
);

const siteUrl = loadEnv('production', process.cwd()).VITE_BGPOOF_SITE_URL;
let redirect = '';
let canonicalHeaders = '';
if (siteUrl) {
  const canonical = new URL(siteUrl);
  if (!['http:', 'https:'].includes(canonical.protocol)) {
    throw new Error('VITE_BGPOOF_SITE_URL must be an HTTP or HTTPS URL');
  }
  const hostname = JSON.stringify(canonical.hostname);
  const wwwHostname = JSON.stringify(`www.${canonical.hostname}`);
  const origin = JSON.stringify(canonical.origin);
  redirect = `
    if (url.hostname === ${wwwHostname} || (url.hostname === ${hostname} && url.origin !== ${origin})) {
      return Response.redirect(${origin} + url.pathname + url.search, 308);
    }
`;
  canonicalHeaders = `
    if (url.hostname !== ${hostname}) headers.set('X-Robots-Tag', 'noindex, follow');
`;
}

// Asset headers are handled by public/_headers. HTML needs headers on the Worker response.
await writeFile(
  'dist/server/cloudflare-entry.js',
  `import app from './index.js';
export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
${redirect}
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname.length > 1 && url.pathname.endsWith('/') && !url.pathname.startsWith('/api/')) {
      url.pathname = url.pathname.replace(/\\/+$/, '');
      return Response.redirect(url.href, 308);
    }
    const response = await app.fetch(request, env, context);
    const headers = new Headers(response.headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
${canonicalHeaders}
    if (response.status >= 400 || url.pathname.startsWith('/api/')) headers.set('X-Robots-Tag', 'noindex');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
};
`,
);
