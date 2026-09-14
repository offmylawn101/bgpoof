import type { ReactNode } from 'react';
import { PageSchema } from './page-schema';
import { SiteFooter } from './site-footer';
import { guidePaths, sitePages, type PagePath } from '@/lib/seo';

export function GuidePage({
  path,
  title,
  intro,
  children,
}: {
  path: PagePath;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="site-shell">
      <PageSchema path={path} />
      <main className="about-page guide-page">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <a href="/">BG Poof</a>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">{sitePages[path].label}</span>
        </nav>
        <h1>{title}</h1>
        <p className="guide-intro">{intro}</p>
        <a className="guide-cta" href="/">
          Remove a photo background
        </a>
        {children}
        <aside className="related-guides" aria-label="Related guides">
          <h2>More help with your photo</h2>
          <ul>
            {guidePaths
              .filter((other) => other !== path)
              .map((other) => (
                <li key={other}>
                  <a href={other}>{sitePages[other].label}</a>
                </li>
              ))}
          </ul>
          <p>
            <a href="/about">How BG Poof handles your photos</a>
          </p>
        </aside>
      </main>
      <SiteFooter />
    </div>
  );
}
