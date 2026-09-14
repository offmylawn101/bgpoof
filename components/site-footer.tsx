import { guidePaths, sitePages } from '@/lib/seo';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>Free to use · No watermarks · No sign-up</span>
      <nav aria-label="Help and information">
        {guidePaths.map((path) => (
          <a key={path} href={path}>
            {sitePages[path].label}
          </a>
        ))}
        <a href="/about">About & licenses</a>
      </nav>
    </footer>
  );
}
