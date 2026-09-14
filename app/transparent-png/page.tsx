import { GuidePage } from '@/components/guide-page';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('/transparent-png');

export default function TransparentPng() {
  return (
    <GuidePage
      path="/transparent-png"
      title="Save and use a transparent PNG"
      intro="BG Poof saves your cutout as a PNG with transparency. Place that file over a different background in an editor, presentation, or page layout without a solid rectangle around the subject."
    >
      <h2>What the checkerboard means</h2>
      <p>
        The gray checkerboard behind a BG Poof result is a preview aid. It shows
        where the image is transparent and is not part of the downloaded file. A
        photo viewer may display those same areas as white or black, depending
        on its own background.
      </p>
      <p>
        To check the file, import the downloaded PNG into an editor that
        supports transparency and put a colored layer underneath it. The color
        should show through the removed areas. If you can still see a
        checkerboard pattern there, check that you saved the PNG rather than a
        screenshot of the result panel. A screenshot captures the visible
        squares as pixels.
      </p>

      <h2>Why the download is PNG instead of JPG</h2>
      <p>
        PNG can store transparency, including partly transparent edge pixels.
        That allows a soft edge around hair or fur instead of requiring every
        pixel to be entirely visible or entirely absent. Ordinary JPG files do
        not support transparency; an export to JPG replaces it with a solid
        background. See{' '}
        <a href="https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types#png_portable_network_graphics">
          MDN&apos;s PNG format reference
        </a>
        .
      </p>
      <p>
        A .png extension alone does not mean a picture has a transparent
        background. PNG can also contain a fully opaque photograph. Converting a
        JPG to PNG preserves the photograph&apos;s existing background unless
        you remove it first.
      </p>

      <h2>Copying versus downloading</h2>
      <p>
        On a computer, right-click the completed cutout and use the
        browser&apos;s copy-image command. Select <strong>Show cutout</strong>{' '}
        if you were viewing the original. Paste into your destination app and
        check the edges against its background.
      </p>
      <p>
        Clipboard behavior depends on both applications. If pasting adds a white
        rectangle, use <strong>Download PNG</strong>, then insert or import that
        file. Downloading also gives you a copy that survives closing the BG
        Poof tab. On a phone, the download button is the simplest place to
        start; saving and sharing options vary by browser.
      </p>

      <h2>Keep a transparent master copy</h2>
      <p>
        Save the PNG before exporting a version for a particular destination. If
        that destination accepts only JPG, choose the background you want in an
        editor and export a separate JPG. Keep the PNG for future layouts.
      </p>
      <p>
        BG Poof keeps the uploaded image&apos;s pixel dimensions in its final
        download. That does not guarantee a perfect outline: the background
        remover can miss fine details or keep parts of the scene. Inspect the
        result at the size you intend to use, especially on a background very
        different from the original. Our{' '}
        <a href="/background-removal-tips">quality guide</a> explains what to
        check before using a cutout.
      </p>
    </GuidePage>
  );
}
