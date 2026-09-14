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
        download tiers. Your browser sends a compact copy of your photo to
        Cloudflare for background removal. BG Poof does not store your photos.
      </p>
      <h2>How it works</h2>
      <p>
        Your original photo stays in your browser. Cloudflare Images identifies
        the subject in the compact copy, then your browser uses the returned
        transparency mask to create a PNG from the original photo. The download
        keeps your original pixel dimensions.
      </p>
      <p>
        Working images are held in browser memory while you use the page. You
        can replace them, clear the result, or close the page when you are done.
        Cloudflare also hosts the website and collects cookie-free
        page-performance metrics. These metrics do not include your photo.{' '}
        <a href="https://developers.cloudflare.com/web-analytics/about/">
          About Cloudflare Web Analytics
        </a>
        .
      </p>
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
