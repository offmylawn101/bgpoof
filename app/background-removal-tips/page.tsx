import { GuidePage } from '@/components/guide-page';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('/background-removal-tips');

export default function BackgroundRemovalTips() {
  return (
    <GuidePage
      path="/background-removal-tips"
      title="Get a better background removal result"
      intro="Start with a sharp photo where the subject is easy to distinguish from its surroundings. BG Poof can still miss details or leave background patches, so inspect the cutout before using it."
    >
      <h2>Use the clearest source you have</h2>
      <p>
        Upload the original file when possible. A screenshot, small thumbnail,
        or repeatedly compressed copy may have lost detail around hair, fur, or
        thin objects. Enlarging a blurry image does not restore the missing
        outline. If you can take another photo, check focus on the subject and
        avoid motion blur.
      </p>
      <p>
        A background with a different color or brightness from the subject may
        make separation easier. White clothing against a white wall, or dark fur
        against a dark sofa, leaves fewer visible clues about the boundary.
        Changing the backdrop or camera angle is worth trying when a new photo
        is an option; it is not a guaranteed fix.
      </p>

      <h2>Crop distractions with room to spare</h2>
      <p>
        If the subject occupies a small part of a large scene, try cropping a
        copy in an image editor before uploading. Keep the complete subject and
        some surrounding space. Cutting through hair, antennae, or an object
        handle removes pixels the background remover cannot recover.
      </p>
      <p>
        BG Poof uses an upload at most 1,536 pixels per side for background
        detection. A closer crop can give a small subject more of that image
        area, but it can also change the result in unhelpful ways. Keep the
        original and compare both cutouts. The download retains the dimensions
        of the file you actually upload, including any crop you made.
      </p>

      <h2>Check the difficult parts individually</h2>
      <ul>
        <li>
          <strong>Hair, fur, and thin legs:</strong> look for missing strands,
          clipped tips, and background left between them. A clean outer outline
          does not mean the small gaps are clear.
        </li>
        <li>
          <strong>Foil and reflective metal:</strong> bright reflections can
          resemble the surrounding background. The remover may discard pieces of
          the object. A different lighting angle may help, but it can also
          change which details are recognized.
        </li>
        <li>
          <strong>Glass and translucent materials:</strong> the original scene
          is visible through the subject. Removing the outer background does not
          reconstruct how that glass would look in a new scene.
        </li>
        <li>
          <strong>Shadows and touching surfaces:</strong> check beneath the
          subject for retained ground or a removed shadow you wanted to keep. BG
          Poof has no separate keep-shadow setting.
        </li>
      </ul>

      <h2>Know when the cutout needs an editor</h2>
      <p>
        Compare the original and cutout, then inspect the downloaded PNG over
        both light and dark backgrounds in an editor. This can reveal a pale
        fringe, leftover background, or an overly transparent edge that the
        preview checkerboard made hard to notice.
      </p>
      <p>
        BG Poof refines edge transparency and color automatically, but there is
        no manual erase or restore brush. If part of the subject is missing,
        keep the original photo for a manual correction. Repeating the same
        upload is not a dependable way to recover it. For a cutout whose exact
        shape matters, use an editor with a mask you can adjust.
      </p>
    </GuidePage>
  );
}
