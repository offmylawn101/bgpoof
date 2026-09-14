import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cutout — Remove photo backgrounds for free',
  description:
    'Paste, drop, or upload a photo and download a full-resolution transparent PNG. Free background removal in your browser. No account. Your photos stay on your device.',
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
