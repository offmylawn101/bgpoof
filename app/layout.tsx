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
      <body>{children}</body>
    </html>
  );
}
