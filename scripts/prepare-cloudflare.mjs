import { writeFile } from 'node:fs/promises';
// Asset headers are handled by public/_headers. HTML needs headers on the Worker response.
await writeFile(
  'dist/server/cloudflare-entry.js',
  `import app from './index.js';
export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    if (url.hostname === 'www.bgpoof.com' || (url.hostname === 'bgpoof.com' && url.protocol === 'http:')) {
      url.hostname = 'bgpoof.com';
      url.protocol = 'https:';
      return Response.redirect(url.href, 308);
    }
    const response = await app.fetch(request, env, context);
    const headers = new Headers(response.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
};
`,
);
