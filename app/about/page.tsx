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
        BG Poof removes photo backgrounds on your device. Your photo is never
        sent to our server. There are no accounts, watermarks, or paid download
        tiers.
      </p>
      <h2>How it works</h2>
      <p>
        The first time you use BG Poof, your browser downloads about 100 MB of
        background-removal software and model files. It saves the model locally
        when browser storage is available, so later visits can reuse it.
        Processing speed depends on your device. Clearing site data removes the
        cached model.
      </p>
      <p>
        Photos are kept in memory while you use the page, then released when you
        replace them, close the page, or clear the result. The server receives
        ordinary requests for the website and model files, but never your photo.
        Cloudflare, our hosting provider, collects cookie-free page-performance
        metrics. These metrics do not include your photo.{' '}
        <a href="https://developers.cloudflare.com/web-analytics/about/">
          About Cloudflare Web Analytics
        </a>
        .
      </p>
      <p>
        JPG, PNG, and WebP photos are supported up to 25 MB and 25 megapixels,
        with a maximum side length of 8,192 pixels. Downloads retain the
        original pixel dimensions. Fine hair, glass, shadows, and busy
        backgrounds can need additional editing; this is an independent
        background remover and results will differ from remove.bg.
      </p>
      <h2>Open source & credits</h2>
      <p>
        <a href="/source/bgpoof-source.tar.gz">Download BG Poof’s source</a>.
        The application code is available under the MIT license. Model files can
        be retrieved using the included download script.
      </p>
      <p>
        Background removal uses{' '}
        <a href="https://huggingface.co/imgly/isnet-general-onnx">
          IMG.LY’s IS-Net ONNX model
        </a>
        , published with MIT license metadata, based on{' '}
        <a href="https://github.com/xuebinqin/DIS">
          Highly Accurate Dichotomous Image Segmentation (DIS)
        </a>{' '}
        by Xuebin Qin and collaborators.{' '}
        <a href="/licenses/DIS-Apache-2.0.txt">Upstream Apache 2.0 license</a>.
      </p>
      <p>
        Inference uses Microsoft’s{' '}
        <a href="https://onnxruntime.ai/">ONNX Runtime</a>.{' '}
        <a href="/licenses/onnxruntime-MIT.txt">MIT license</a>. The interface
        also uses React, Lucide, and Base UI;{' '}
        <a href="/licenses/dependencies.txt">dependency notices</a> are included
        in the source package.
      </p>
      <p>
        Example photo by{' '}
        <a href="https://unsplash.com/fr/photos/golden-retriever-assis-sur-le-sol-au-coucher-du-soleil-w-dZelX6svs">
          Helena Lopes on Unsplash
        </a>
        , used under the{' '}
        <a href="https://unsplash.com/license">Unsplash License</a>. Its example
        cutout was processed with this site’s own engine.
      </p>
      <p>
        BG Poof is independent and is not affiliated with remove.bg or Canva.
      </p>
    </main>
  );
}
