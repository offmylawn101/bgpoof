import type { Metadata } from 'next';
import { siteUrl } from './site-settings';

export const sitePages = {
  '/': {
    title: 'BG Poof — Remove photo backgrounds for free',
    description:
      'Remove a photo background for free. Paste, drop, or upload a JPG, PNG, or WebP and download a transparent PNG at the original size. No account or watermark.',
    label: 'Background remover',
  },
  '/how-to-remove-background': {
    title: 'How to remove a photo background for free | BG Poof',
    description:
      'Upload, drag and drop, or paste a photo into BG Poof. Learn how to save a transparent PNG, copy your cutout, and remove backgrounds on a phone.',
    label: 'How to remove a background',
  },
  '/transparent-png': {
    title: 'Transparent PNGs: save and use your cutout | BG Poof',
    description:
      'Learn why a transparent PNG can look white or black, how to keep transparency when copying a cutout, and why saving as JPG brings a background back.',
    label: 'Saving a transparent PNG',
  },
  '/background-removal-tips': {
    title: 'Background removal tips: missing details and edges | BG Poof',
    description:
      'Troubleshoot missing hair, foil, glass, and leftover backgrounds. See which photo changes may help BG Poof and when a cutout needs manual editing.',
    label: 'Getting a better cutout',
  },
  '/about': {
    title: 'About & licenses — BG Poof',
    description:
      'How BG Poof processes photos, handles uploads and analytics, and creates transparent PNGs. Read file limits, privacy details, and software credits.',
    label: 'About, privacy & licenses',
  },
} as const;

export type PagePath = keyof typeof sitePages;
export const guidePaths = [
  '/how-to-remove-background',
  '/transparent-png',
  '/background-removal-tips',
] as const;

export function absoluteUrl(path: string) {
  return new URL(path, siteUrl).href;
}

export function pageMetadata(path: PagePath): Metadata {
  const { title, description } = sitePages[path];
  const image = {
    url: absoluteUrl('/social-preview.png'),
    width: 1200,
    height: 630,
    alt: 'BG Poof: a dog photo before and after background removal. Free, no account, no watermark.',
  };
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(path) },
    robots: 'index, follow, max-image-preview:large',
    openGraph: {
      type: 'website',
      locale: 'en_US',
      siteName: 'BG Poof',
      title,
      description,
      url: absoluteUrl(path),
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export function pageSchema(path: PagePath) {
  const page = sitePages[path];
  const website = {
    '@type': 'WebSite',
    '@id': absoluteUrl('/#website'),
    url: absoluteUrl('/'),
    name: 'BG Poof',
    inLanguage: 'en',
  };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      ...(path === '/' ? [website] : []),
      {
        '@type': path === '/about' ? 'AboutPage' : 'WebPage',
        '@id': absoluteUrl(`${path}#webpage`),
        url: absoluteUrl(path),
        name: page.title,
        description: page.description,
        inLanguage: 'en',
        isPartOf: { '@id': website['@id'] },
        ...(path !== '/' && {
          breadcrumb: { '@id': absoluteUrl(`${path}#breadcrumb`) },
        }),
      },
      ...(path === '/'
        ? []
        : [
            {
              '@type': 'BreadcrumbList',
              '@id': absoluteUrl(`${path}#breadcrumb`),
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: 'BG Poof',
                  item: absoluteUrl('/'),
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: page.label,
                  item: absoluteUrl(path),
                },
              ],
            },
          ]),
    ],
  };
}
