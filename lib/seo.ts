import type { Metadata } from 'next';
import { siteUrl } from './site-settings';

export const sitePages = {
  '/': {
    title: 'Remove BG from Images Free: HD PNG, No Sign-Up | BG Poof',
    description:
      'Free background remover. Remove the background from an image in seconds and download a full-size transparent PNG. No account, no watermark.',
    label: 'Background remover',
  },
  '/id': {
    title: 'Hapus Background Foto Gratis: PNG HD, Tanpa Daftar | BG Poof',
    description:
      'Hapus background foto gratis dalam hitungan detik, lalu unduh PNG transparan ukuran penuh. Tanpa akun, tanpa watermark. Mendukung JPG, PNG, dan WebP.',
    label: 'Bahasa Indonesia',
  },
  '/pt-br': {
    title: 'Remover Fundo de Imagem Grátis: PNG HD, Sem Cadastro | BG Poof',
    description:
      'Remova o fundo de qualquer imagem em segundos e baixe um PNG transparente em tamanho original. Grátis, sem cadastro e sem marca d’água.',
    label: 'Português (Brasil)',
  },
  '/es': {
    title: 'Quitar Fondo de Imagen Gratis: PNG HD, Sin Registro | BG Poof',
    description:
      'Quita el fondo de cualquier imagen en segundos y descarga un PNG transparente a tamaño completo. Gratis, sin registro y sin marca de agua.',
    label: 'Español',
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
  '/remove-bg-alternative': {
    title: 'Free remove.bg Alternative: No Account, Full-Size PNG | BG Poof',
    description:
      'remove.bg is moving into Canva on December 1, 2026. BG Poof is a free, independent background remover with full-size PNGs, no account, and no watermark.',
    label: 'A free remove.bg alternative',
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
  '/remove-bg-alternative',
] as const;
export type GuidePath = (typeof guidePaths)[number];

const homeVersions = {
  '/': { language: 'en', ogLocale: 'en_US' },
  '/id': { language: 'id', ogLocale: 'id_ID' },
  '/pt-br': { language: 'pt-BR', ogLocale: 'pt_BR' },
  '/es': { language: 'es', ogLocale: 'es_ES' },
} as const;
export type HomePath = keyof typeof homeVersions;
export const homePaths = Object.keys(homeVersions) as HomePath[];
const isHome = (path: PagePath): path is HomePath => path in homeVersions;

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
    alternates: {
      canonical: absoluteUrl(path),
      ...(isHome(path) && {
        languages: {
          ...Object.fromEntries(
            homePaths.map((home) => [
              homeVersions[home].language,
              absoluteUrl(home),
            ]),
          ),
          'x-default': absoluteUrl('/'),
        },
      }),
    },
    robots: 'index, follow, max-image-preview:large',
    openGraph: {
      type: 'website',
      locale: isHome(path) ? homeVersions[path].ogLocale : 'en_US',
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
        inLanguage: isHome(path) ? homeVersions[path].language : 'en',
        isPartOf: { '@id': website['@id'] },
        ...(!isHome(path) && {
          breadcrumb: { '@id': absoluteUrl(`${path}#breadcrumb`) },
        }),
      },
      ...(isHome(path)
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
