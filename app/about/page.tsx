import { analyticsId, webAnalyticsEnabled } from '@/lib/site-settings';

export const metadata = {
  title: 'About & licenses — BG Poof',
  alternates: { canonical: '/about' },
};
export default function About() {
  return (
    <main className="about-page">
      <a href="/">← Back to BG Poof</a>
      <h1>Your photos stay yours.</h1>
      <p>
        BG Poof removes photo backgrounds without accounts, watermarks, or paid
        download tiers. Your browser uploads your photo, resized when needed, to
        Cloudflare for background removal. When automatic refinement is enabled,
        our processing server also receives that upload and its mask. BG Poof
        does not store your photos.
      </p>
      <h2>How it works</h2>
      <p>
        Your browser keeps the original photo to create the final download. PNGs
        within 1,536 pixels per side and 2 MiB are uploaded unchanged; other
        photos are resized and compressed before upload. Cloudflare Images
        identifies the subject. Our server then automatically refines edge
        transparency and reduces background color around those edges when
        automatic refinement is enabled. Your browser cleans up remaining
        background color around the edges and creates the final PNG from your
        original photo. The download keeps your original pixel dimensions. The
        upload is held in memory only while our server processes it.
      </p>
      <p>
        Working images are held in browser memory while you use the page. You
        can replace them, clear the result, or close the page when you are done.
      </p>
      <h2>Analytics</h2>
      {analyticsId ? (
        <p>
          We use Google Analytics to understand how people use BG Poof. It uses
          cookies and collects information about page visits, browser and device
          details, and site interactions.{' '}
          <a href="https://policies.google.com/technologies/partner-sites">
            How Google uses this information
          </a>
          .
        </p>
      ) : (
        <p>Google Analytics is disabled on this installation.</p>
      )}
      <p>Your photos are not included in analytics.</p>
      {webAnalyticsEnabled && (
        <p>
          Cloudflare also hosts the website and collects cookie-free
          page-performance metrics. These metrics do not include your photo.{' '}
          <a href="https://developers.cloudflare.com/web-analytics/about/">
            About Cloudflare Web Analytics
          </a>
          .
        </p>
      )}
      <h2>Supported photos</h2>
      <p>
        JPG, PNG, and WebP photos are supported up to 25 MB and 25 megapixels,
        with a maximum side length of 8,192 pixels. We aim to have a result
        ready within five seconds, but connection speed, image size, and service
        load affect the wait. Fine hair, glass, shadows, and busy backgrounds
        can need additional editing; results will differ from remove.bg.
      </p>
      <h2>Credits</h2>
      <p>
        Background removal uses{' '}
        <a href="https://developers.cloudflare.com/images/optimization/features/#segment">
          Cloudflare Images foreground segmentation
        </a>
        , accessed through its{' '}
        <a href="https://developers.cloudflare.com/images/optimization/binding/">
          Workers binding
        </a>
        .
      </p>
      <p>
        The interface uses React, Lucide, and Base UI;{' '}
        <a href="/licenses/dependencies.txt">dependency notices</a> are
        available here.
      </p>
      <p>
        Example photo by{' '}
        <a href="https://unsplash.com/fr/photos/golden-retriever-assis-sur-le-sol-au-coucher-du-soleil-w-dZelX6svs">
          Helena Lopes on Unsplash
        </a>
        , used under the{' '}
        <a href="https://unsplash.com/license">Unsplash License</a>. Its example
        cutout was processed with Cloudflare Images and this site’s browser
        compositing.
      </p>
      <p>
        BG Poof is independent and is not affiliated with remove.bg or Canva.
      </p>
    </main>
  );
}
