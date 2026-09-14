# remove.bg reference review

Date: 2026-09-13 UTC. Desktop Chromium 144, viewport 1440 × 1000, fresh unauthenticated contexts. Public test image only.

This is a historical review of remove.bg, not a description of BG Poof's current behavior. The research artifacts named below are not included in this repository. See [README.md](../README.md) for the current pipeline and [ASSETS.md](ASSETS.md) for the maintained test photograph.

## Site status observed on the review date

The live homepage banner announces moving background removal to Canva and ending the standalone website on 1 December 2026 at 9:00am CET. The banner links to https://www.remove.bg/faq. Canva account/payment requirements were not tested; the current remove.bg upload works without an account for initial test runs.

## Input interactions

- Homepage presents a large blue pill Upload Image button inside a white rounded card, below/right of a large headline and a before/after hero photo. Secondary text advertises dropping files and pasting an image or URL. Four clickable sample thumbnails cover people, animals, cars, products.
- Upload button opens a real browser file chooser. Observed input: accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp", multiple=false. Selecting the 960 × 1440 public JPEG at public-sample.jpg entered /upload and completed background removal without signing in.
- Dragging over the page shows a full viewport amber translucent scrim, four thick white corner brackets inset from edges, and centered drop instruction. A synthetic DOM DragEvent carrying a real File through DataTransfer successfully exercised dragenter/drop and produced the cutout. This validates event handling, not physical OS drag automation.
- Real system clipboard PNG write followed by Control+V started image processing and navigated to /upload. This later test was intercepted by hCaptcha, so paste-to-result completion was not verified. The challenge was not interacted with or bypassed.
- URL opens a native browser prompt labeled Image URL, confirmed by rendered behavior and current public JS. An initial automation assumed an HTML modal and timed out; no URL upload completion was verified.

## Loading and swipe

- While processing, the original is darkened and covered in scattered small gold/yellow four-point sparkles that move/twinkle. The current upload thumbnail has a small circular spinner. Toolbar controls are disabled.
- Once ready, the original photo and cutout have exactly aligned dimensions. The cutout stays fixed on top; original background is clipped away, revealing the checkerboard beneath.
- Exact live application implementation confirms: clip percentage 100 → 0, duration 2000ms, easing easeInOutCubic. The polygon covers (0,0) → (p%,0) → (p%,100%) → (0,100%). This means the dividing edge travels RIGHT TO LEFT, exposing transparency on the right first.
- This is a clean hard vertical wipe with no visible ornate scanner bar during the automatic reveal. Do not conflate the preceding gold sparkle loading effect with the result wipe.
- Screenshot/video evidence confirms this behavior. DOM instrumentation captured changing percentage values (100, 99.37, 95.45, 85.19, 65.54, 36.47, 15.97, 5.65, 0.78, 0.01, 0). On the measured run, result reveal began about 3.5 seconds after selection and finished around 5.9 seconds; service and rendering latency vary.
- The shared comparison component is an HTML range with min=0, max=100, step=.01. Public JS defines comparison toggles toward 0 or 100 in 300ms with the same cubic easing. Range was disabled during the initial result view; manual dragging on that result was not verified. The homepage samples have an enabled draggable comparison handle centered initially at 50%.

## Result controls and download

The result is centered on a white page inside a rounded image card, with checkerboard transparency and a top toolbar offering Cutout, Background, Effects, Adjust, Design, comparison icon, undo/redo, Download. A bottom image strip has a plus tile and current image thumbnail. An Edit in Canva call to action overlays the result.

The Download menu was successfully opened after file upload. For the 960 × 1440 source, it offered Preview 408 × 612 labeled Free and Max 960 × 1440 labeled Unlock. An actual PNG download was not completed: later attempts encountered disabled controls after the site's anti-bot restrictions. Do not claim download success from this review.

## Artifacts

- homepage.png / homepage.html / homepage.txt: rendered homepage evidence.
- file-result.png: completed real file upload result.
- download-menu.png / download-menu.html: free preview versus unlocked maximum resolution.
- drop-overlay.png / drop-result.png: drop affordance and result.
- paste-result.png: hCaptcha restriction after real clipboard paste initiated processing.
- file-observations.json: sampled DOM ranges/clip paths during actual removal.
- sequence.png: 4 × 4 video contact sheet, showing processing sparkles and right-to-left wipe.
- video-file/_.webm and video-upload/_.webm: recorded sessions.
- public-sample.jpg: public non-sensitive source image used for testing; 960 × 1440.
- reference-app.js: downloaded public production browser asset used to confirm animation timing. Research only; do not copy it into the implementation.

## Source URLs

- https://www.remove.bg/
- https://www.remove.bg/upload
- https://www.remove.bg/faq
- https://static.remove.bg/uploader-examples/person/6.jpg
- https://static.remove.bg/remove-bg-web/44da3d5dd24b0fed982d4d150d86455c7d598017/vite/assets/application-97fe3a3c.js

Scope: mechanics, visual behavior, restrictions. The proprietary segmentation algorithm and removal quality across image categories were not reverse engineered or benchmarked. No project files were modified.
