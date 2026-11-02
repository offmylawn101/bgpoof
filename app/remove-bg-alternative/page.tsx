import { GuidePage } from '@/components/guide-page';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('/remove-bg-alternative');

const samples = [
  {
    name: 'shoe',
    width: 480,
    height: 320,
    alt: 'Yellow clogs on sand',
    caption:
      'Clean edges. The holes in the shoes are kept and the shadow on the sand is gone.',
  },
  {
    name: 'car',
    width: 480,
    height: 320,
    alt: 'Red vintage sports car on a street',
    caption:
      'The street and the people behind the car are gone, and the mirror survives. Some dark shadow remains under the front of the car.',
  },
  {
    name: 'glass',
    width: 480,
    height: 640,
    alt: 'Cut-glass goblet in a studio',
    caption:
      'The outline is clean, but the glass stays opaque, so a new background won’t show through it.',
  },
  {
    name: 'plant',
    width: 480,
    height: 319,
    alt: 'Flowers and leaves filling the whole frame',
    caption:
      'This one failed. With plants filling the frame and no clear background, the whole image came back almost invisible. A photo with space around the subject is more likely to work.',
  },
];

export default function RemoveBgAlternative() {
  return (
    <GuidePage
      path="/remove-bg-alternative"
      title="A free remove.bg alternative"
      intro="remove.bg’s background removal is moving into Canva on December 1, 2026. If you want a standalone tool with no account, BG Poof removes the background and gives you a full-size transparent PNG for free."
    >
      <h2>What is changing at remove.bg</h2>
      <ul>
        <li>
          <strong>The tool:</strong> background removal is moving into the Canva
          platform, according to{' '}
          <a href="https://www.remove.bg/faq">remove.bg’s FAQ</a>.
        </li>
        <li>
          <strong>Credits:</strong> its{' '}
          <a href="https://www.remove.bg/gtc">terms</a> say credits can only be
          used until December 1, 2026. Unused credits then expire without a
          refund.
        </li>
        <li>
          <strong>The API:</strong> its{' '}
          <a href="https://www.remove.bg/api">API page</a> says background
          removal moves to Leonardo.Ai, also part of Canva, starting that day.{' '}
          <a href="https://docs.leonardo.ai/docs/migrate-from-the-removebg-api-to-leonardoai">
            Leonardo’s migration guide
          </a>{' '}
          lists a price of $0.1047 per image.
        </li>
      </ul>
      <p>
        We haven’t seen remove.bg say what happens to its address or existing
        links, so save anything you need before December 1.
      </p>

      <h2>How the two compare</h2>
      <table className="comparison-table">
        <thead>
          <tr>
            <th scope="col">Feature</th>
            <th scope="col">remove.bg today</th>
            <th scope="col">BG Poof</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Free downloads</th>
            <td>
              Previews up to 0.25 megapixels;{' '}
              <a href="https://www.remove.bg/help/a/is-remove-bg-free-">
                full size uses a credit
              </a>
            </td>
            <td>Original dimensions, up to 25 megapixels</td>
          </tr>
          <tr>
            <th scope="row">Account</th>
            <td>Not for website previews; needed for credits</td>
            <td>Never</td>
          </tr>
          <tr>
            <th scope="row">Several photos at once</th>
            <td>Yes</td>
            <td>No, one at a time</td>
          </tr>
          <tr>
            <th scope="row">New backgrounds and touch-up brush</th>
            <td>Yes</td>
            <td>No, transparent PNG only</td>
          </tr>
          <tr>
            <th scope="row">API and plugins</th>
            <td>Yes, with the API moving to Leonardo.Ai</td>
            <td>No</td>
          </tr>
        </tbody>
      </table>
      <p>
        If you need bulk processing, background replacement, manual touch-ups,
        or an API, BG Poof isn’t the right replacement today. We also haven’t
        benchmarked cutout quality against remove.bg, so we make no claim about
        which gives better results.
      </p>

      <h2>Real results from BG Poof</h2>
      <p>
        We ran these openly licensed photos through the live site on November 2,
        2026, and didn’t edit the output. One of them failed, and it’s included
        too. The checkerboard shows the transparent areas.
      </p>
      <div className="sample-list">
        {samples.map((sample) => (
          <figure key={sample.name}>
            <div className="sample-pair">
              <img
                src={`/samples/${sample.name}.webp`}
                alt={sample.alt}
                width={sample.width}
                height={sample.height}
                loading="lazy"
              />
              <img
                className="checkerboard"
                src={`/samples/${sample.name}-cutout.webp`}
                alt={`${sample.alt}, after background removal`}
                width={sample.width}
                height={sample.height}
                loading="lazy"
              />
            </div>
            <figcaption>{sample.caption}</figcaption>
          </figure>
        ))}
      </div>
      <p>
        Photos: public domain (CC0) on Wikimedia Commons:{' '}
        <a href="https://commons.wikimedia.org/wiki/File:Beach-sand-shoe-green-yellow-product-shoes-sneakers-footwear-clog-outdoor-shoe-1121290.jpg">
          clogs
        </a>
        ,{' '}
        <a href="https://commons.wikimedia.org/wiki/File:Toyota_Sports_800_(No.20)_(23101511322).jpg">
          car
        </a>
        ,{' '}
        <a href="https://commons.wikimedia.org/wiki/File:Wine_Glass_MET_DP236486.jpg">
          glass
        </a>
        ,{' '}
        <a href="https://commons.wikimedia.org/wiki/File:Potted_Plant_-_50087602963.jpg">
          plant
        </a>
        .
      </p>

      <h2>How to switch</h2>
      <ol>
        <li>
          Save any results you still need from remove.bg before December 1.
        </li>
        <li>
          <a href="/">Open BG Poof</a> and upload, drop, or paste a JPG, PNG, or
          WebP.
        </li>
        <li>Check the cutout, then download the transparent PNG.</li>
      </ol>

      <h2>About this page</h2>
      <p>
        BG Poof is independent and isn’t affiliated with or endorsed by
        remove.bg or Canva. remove.bg is a Canva Austria GmbH brand. Details
        about remove.bg come from the pages linked above, checked on November 2,
        2026, and may have changed since.
      </p>
    </GuidePage>
  );
}
