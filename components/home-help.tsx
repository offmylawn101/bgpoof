import { guidePaths, sitePages } from '@/lib/seo';

export function HomeHelp() {
  return (
    <section className="home-help" aria-labelledby="how-heading">
      <h2 id="how-heading">A photo background remover with no sign-up</h2>
      <p>
        Make a cutout for a product listing, profile picture, or design. BG Poof
        returns a transparent PNG at your photo’s original pixel dimensions,
        with no watermark or paid download tier.
      </p>
      <ol className="how-steps">
        <li>
          <h3>1. Add your photo</h3>
          <p>
            Upload a JPG, PNG, or WebP. You can also drop a file anywhere on
            this page or paste an image from your clipboard.
          </p>
        </li>
        <li>
          <h3>2. Check the cutout</h3>
          <p>
            Background removal starts automatically. Once it finishes, use “Show
            original” to compare the result with your photo.
          </p>
        </li>
        <li>
          <h3>3. Save the PNG</h3>
          <p>
            Download the transparent image, or right-click the finished cutout
            to copy it. The checkerboard is only a preview of the transparent
            area.
          </p>
        </li>
      </ol>
      <div className="home-questions">
        <h2>Before you upload</h2>
        <details>
          <summary>Is background removal really free?</summary>
          <p>
            Yes. You can remove a background and download the PNG without
            creating an account or paying. BG Poof adds no watermark. To keep
            the service available, removal requests are rate limited; if you
            reach the limit, wait a minute and try again.
          </p>
        </details>
        <details>
          <summary>What photos can I upload?</summary>
          <p>
            JPG, PNG, and WebP files up to 25 MB and 25 megapixels, with no side
            longer than 8,192 pixels. Use the clearest original you have.
            Blurred edges and subjects that blend into the background can be
            difficult to separate.
          </p>
        </details>
        <details>
          <summary>Will it keep hair, glass, and shiny objects?</summary>
          <p>
            Not always. Thin hair, transparent glass, reflective foil, and
            shadows can confuse automatic removal. BG Poof refines edges, but it
            cannot reliably recover a large part of a subject that was missed.
            Read the{' '}
            <a href="/background-removal-tips">
              photo quality and troubleshooting guide
            </a>{' '}
            before retrying.
          </p>
        </details>
        <details>
          <summary>Where does my photo go?</summary>
          <p>
            Cloudflare processes your upload. Our processing server also
            receives it for automatic edge refinement when that is enabled. BG
            Poof does not save uploads or results; your browser keeps the
            working images while you use the page.{' '}
            <a href="/about">Read the processing and privacy details.</a>
          </p>
        </details>
      </div>
      <nav className="guide-links" aria-label="Photo guides">
        {guidePaths.map((path) => (
          <a key={path} href={path}>
            {sitePages[path].label}
            <span aria-hidden="true"> →</span>
          </a>
        ))}
      </nav>
    </section>
  );
}
