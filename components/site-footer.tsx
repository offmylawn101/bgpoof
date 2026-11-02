import { homeCopy } from '@/lib/copy';
import { guidePaths, homePaths, sitePages, type HomePath } from '@/lib/seo';

const languageTags: Record<HomePath, string> = {
  '/': 'en',
  '/id': 'id',
  '/pt-br': 'pt-BR',
  '/es': 'es',
};

export function SiteFooter({ home = '/' }: { home?: HomePath }) {
  const { footer } = homeCopy[home];
  return (
    <footer className="site-footer">
      <span>{footer.tagline}</span>
      <nav aria-label={footer.navigation}>
        {guidePaths.map((path) => (
          <a key={path} href={path}>
            {footer.guides[path]}
          </a>
        ))}
        <a href="/about">{footer.about}</a>
      </nav>
      <nav aria-label={footer.languages}>
        {homePaths.map((path) => (
          <a
            key={path}
            href={path}
            lang={languageTags[path]}
            hrefLang={languageTags[path]}
            aria-current={path === home ? 'true' : undefined}
          >
            {path === '/' ? 'English' : sitePages[path].label}
          </a>
        ))}
      </nav>
    </footer>
  );
}
