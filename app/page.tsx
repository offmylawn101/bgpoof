import BackgroundRemover from '@/components/background-remover';
import { HomeHelp } from '@/components/home-help';
import { PageSchema } from '@/components/page-schema';
import { SiteFooter } from '@/components/site-footer';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('/');

export default function Home() {
  return (
    <>
      <PageSchema path="/" />
      <BackgroundRemover footer={<SiteFooter />}>
        <HomeHelp />
        <noscript>
          <p className="no-script">
            Enable JavaScript to upload a photo and remove its background. The
            guides linked on this page explain how the tool works.
          </p>
        </noscript>
      </BackgroundRemover>
    </>
  );
}
