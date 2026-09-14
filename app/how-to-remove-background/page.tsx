import { GuidePage } from '@/components/guide-page';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('/how-to-remove-background');

export default function HowToRemoveBackground() {
  return (
    <GuidePage
      path="/how-to-remove-background"
      title="How to remove a photo background"
      intro="Upload a photo to BG Poof, wait for the cutout, then download the transparent PNG. There is no account to create or watermark to remove."
    >
      <h2>Choose a file, drop it, or paste it</h2>
      <p>
        Open <a href="/">the background remover</a> and select{' '}
        <strong>Upload image</strong>. Choose one JPG, PNG, or WebP from your
        device. On a computer, you can also drag the file onto the page, or copy
        an image and press Ctrl + V on Windows or Linux, or Command + V on a
        Mac.
      </p>
      <p>
        Pasting needs an image in your clipboard. A copied web address or a
        file&apos;s name will not upload the photo. If a website&apos;s copy
        command does not work, save the image to your device and use the upload
        button. BG Poof processes one photo at a time.
      </p>

      <h2>Wait for the download button</h2>
      <p>
        Removal starts as soon as you select a supported image. The status text
        shows the current stage. A cutout preview can appear while the final PNG
        is still being prepared; wait for <strong>Download PNG</strong> before
        saving your result.
      </p>
      <p>
        Keep this tab open until you have saved the file. Your browser creates
        the download and holds the result in memory, so refreshing or closing
        the page loses that working copy. There is no account history to reopen
        it from. If you selected the wrong image, choose Cancel or upload the
        correct photo.
      </p>

      <h2>Check the cutout and save it</h2>
      <p>
        Use <strong>Show original</strong> to compare the result, then switch
        back with <strong>Show cutout</strong>. Check hair, thin parts, and gaps
        between objects. The checkerboard marks transparent areas; it is not
        added to your downloaded PNG.
      </p>
      <p>
        Select <strong>Download PNG</strong> to save the file at your uploaded
        image&apos;s pixel dimensions. On desktop, you can also right-click the
        visible cutout and choose your browser&apos;s copy-image command. If the
        destination app loses transparency when pasting, import the downloaded
        PNG instead. See{' '}
        <a href="/transparent-png">how transparent PNGs work</a>.
      </p>

      <h2>Uploading from a phone</h2>
      <p>
        Tap <strong>Upload image</strong> and use your phone&apos;s file or
        photo picker. Download options and save locations depend on your
        browser. If the phone offers a format BG Poof cannot read, export a JPG,
        PNG, or WebP first. Renaming a file&apos;s extension does not convert
        it.
      </p>
      <p>
        Files must fit all three limits: 25 MB, 25 megapixels, and 8,192 pixels
        on the longest side. Reduce the image dimensions in an editor if
        necessary. Processing needs an internet connection, and large files or a
        busy service can take longer. For missing details or unwanted background
        patches, read the{' '}
        <a href="/background-removal-tips">
          photo quality tips and limitations
        </a>
        .
      </p>
    </GuidePage>
  );
}
