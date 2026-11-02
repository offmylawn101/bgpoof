import type { Metadata } from 'next';
import { Html } from '@/components/html';
import { analyticsId, panelApp, siteUrl } from '@/lib/site-settings';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: 'BG Poof',
  title: 'BG Poof',
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Html>
      {analyticsId || panelApp ? (
        <head>
          {analyticsId ? (
            // Google's tag is the page's heaviest script, so it waits for the load event.
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${analyticsId}');
addEventListener('load', function () {
  var tag = document.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtag/js?id=${analyticsId}';
  document.head.appendChild(tag);
});`,
              }}
            />
          ) : null}
          {panelApp ? (
            <script
              defer
              src="https://panel.offmylawn.com/a.js"
              data-app={panelApp}
            />
          ) : null}
        </head>
      ) : null}
      <body>{children}</body>
    </Html>
  );
}
