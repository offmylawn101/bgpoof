import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://bgpoof.com'),
  alternates: { canonical: '/' },
  title: 'BG Poof — Remove photo backgrounds for free',
  description:
    'Paste, drop, or upload a photo and download a full-resolution transparent PNG. Free background removal powered by Cloudflare. No account or watermark.',
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* oxlint-disable-next-line nextjs/next-script-for-ga -- Preserve the supplied async Google tag in the server-rendered head. */}
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-2L8534ZQ4J"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-2L8534ZQ4J');`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
