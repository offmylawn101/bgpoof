import { pageSchema, type PagePath } from '@/lib/seo';

export function PageSchema({ path }: { path: PagePath }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(pageSchema(path)).replace(/</g, '\\u003c'),
      }}
    />
  );
}
