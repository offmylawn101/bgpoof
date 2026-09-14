import { absoluteUrl, sitePages } from '@/lib/seo';

export function GET() {
  // No invented modification dates: only actual public, canonical pages belong here.
  const urls = Object.keys(sitePages)
    .map(
      (path) =>
        `<url><loc>${absoluteUrl(path).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</loc></url>`,
    )
    .join('\n');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
}
