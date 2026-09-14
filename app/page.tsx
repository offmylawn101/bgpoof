'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { removePhotoBackground, type RemovalProgress } from '@/lib/removal';
import { registerDownloadTool } from '@/lib/webmcp';

type Photo = {
  original: string;
  preview?: string;
  result?: string;
  name: string;
  width: number;
  height: number;
};
const ACCEPT = 'image/jpeg,image/png,image/webp';
const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export default function Home() {
  const ready = useSyncExternalStore(
    subscribeToHydration,
    clientReady,
    serverReady,
  );
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<RemovalProgress>({
    message: 'Preparing your photo…',
    value: null,
  });
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [compare, setCompare] = useState(100);
  const [revealing, setRevealing] = useState(false);
  const [demoCompare, setDemoCompare] = useState(47);
  const input = useRef<HTMLInputElement>(null);
  const operation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const photoRef = useRef<Photo | null>(null);
  const dragDepth = useRef(0);
  const animationFrame = useRef(0);
  const resultHeading = useRef<HTMLHeadingElement>(null);

  const replacePhoto = useCallback((next: Photo | null) => {
    const previous = photoRef.current;
    if (previous?.original && previous.original !== next?.original)
      URL.revokeObjectURL(previous.original);
    if (previous?.result && previous.result !== next?.result)
      URL.revokeObjectURL(previous.result);
    if (previous?.preview && previous.preview !== next?.preview)
      URL.revokeObjectURL(previous.preview);
    photoRef.current = next;
    setPhoto(next);
  }, []);

  const reset = useCallback(() => {
    operation.current += 1;
    controller.current?.abort();
    cancelAnimationFrame(animationFrame.current);
    replacePhoto(null);
    setBusy(false);
    setError('');
    setRevealing(false);
    setCompare(100);
  }, [replacePhoto]);

  const start = useCallback(
    async (file: File) => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setError('Choose a JPG, PNG, or WebP photo.');
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        setError('This photo is too large. Choose one smaller than 25 MB.');
        return;
      }
      const id = ++operation.current;
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      cancelAnimationFrame(animationFrame.current);
      setError('');
      setBusy(true);
      setRevealing(false);
      setCompare(100);
      setProgress({ message: 'Preparing your photo…', value: null });
      let original = '';
      let bitmap: ImageBitmap | undefined;
      try {
        bitmap = await createImageBitmap(file);
        const { width, height } = bitmap;
        if (id !== operation.current) return;
        if (width * height > 25_000_000 || width > 8192 || height > 8192) {
          throw new Error(
            'Choose a photo up to 25 megapixels, with each side under 8,193 pixels.',
          );
        }
        original = URL.createObjectURL(file);
        let current: Photo = { original, name: file.name, width, height };
        replacePhoto(current);
        const blob = await removePhotoBackground(
          bitmap,
          abort.signal,
          (next) => {
            if (id === operation.current) setProgress(next);
          },
          (preview) => {
            if (id !== operation.current) return;
            current = { ...current, preview: URL.createObjectURL(preview) };
            replacePhoto(current);
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
              setCompare(0);
            } else {
              setRevealing(true);
              animateReveal(animationFrame, setCompare, () =>
                setRevealing(false),
              );
            }
          },
        );
        if (id !== operation.current) return;
        const result = URL.createObjectURL(blob);
        replacePhoto({ ...current, result });
        setBusy(false);
        resultHeading.current?.focus();
      } catch (cause) {
        if (id !== operation.current || abort.signal.aborted) return;
        setBusy(false);
        setError(
          cause instanceof Error
            ? cause.message
            : 'We couldn’t read this photo. Try another JPG, PNG, or WebP.',
        );
      } finally {
        // A transferred bitmap is already detached; also close on validation/cancellation.
        bitmap?.close();
      }
    },
    [replacePhoto],
  );

  const receive = useCallback(
    (files: FileList | File[]) => {
      if (!files.length) return;
      if (files.length > 1) {
        setError('Choose one photo at a time.');
        return;
      }
      void start(files[0]);
    },
    [start],
  );

  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.items ?? [])
        .filter((item) => item.kind === 'file')
        .map((item) => item.getAsFile())
        .filter((file): file is File => !!file);
      if (files.length) {
        event.preventDefault();
        receive(files);
      }
    };
    const enter = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    };
    const over = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }
    };
    const leave = (event: DragEvent) => {
      event.preventDefault();
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (!dragDepth.current) setDragging(false);
    };
    const drop = (event: DragEvent) => {
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      if (event.dataTransfer?.files.length) receive(event.dataTransfer.files);
    };
    const blur = () => {
      dragDepth.current = 0;
      setDragging(false);
    };
    window.addEventListener('paste', paste);
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('paste', paste);
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
      window.removeEventListener('blur', blur);
    };
  }, [receive]);

  useEffect(() => registerDownloadTool(() => photoRef.current), []);

  useEffect(
    () => () => {
      controller.current?.abort();
      cancelAnimationFrame(animationFrame.current);
      if (photoRef.current?.original)
        URL.revokeObjectURL(photoRef.current.original);
      if (photoRef.current?.result)
        URL.revokeObjectURL(photoRef.current.result);
      if (photoRef.current?.preview)
        URL.revokeObjectURL(photoRef.current.preview);
    },
    [],
  );

  async function tryExample() {
    try {
      const response = await fetch('/example.jpg');
      if (!response.ok)
        throw new Error(
          'The example couldn’t load. Upload your own photo to try it.',
        );
      await start(
        new File([await response.blob()], 'example.jpg', {
          type: 'image/jpeg',
        }),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'The example couldn’t load.',
      );
    }
  }

  const downloadName = photo?.name.replace(/\.[^.]+$/, '') + '-no-bg.png';

  return (
    <div className="site-shell" data-ready={ready}>
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="BG Poof home">
          <span className="brand-icon">
            <span />
          </span>
          bgpoof<span className="brand-dot">.</span>
        </a>
        <span className="header-note">
          <span className="status-dot" /> Free. No account needed.
        </span>
        <a href="/source/bgpoof-source.tar.gz" className="source-link">
          Open source <ArrowUpRight size={15} />
        </a>
      </header>

      <main>
        <input
          ref={input}
          disabled={!ready}
          type="file"
          accept={ACCEPT}
          aria-label="Upload photo"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            if (event.target.files) receive(event.target.files);
            event.target.value = '';
          }}
        />
        {!photo ? (
          <section className="home-workspace" aria-labelledby="main-heading">
            <div className="intro">
              <span className="eyebrow">
                <Sparkles size={15} /> A little less background. A lot more
                photo.
              </span>
              <h1 id="main-heading">
                Remove the
                <br />
                <span>background.</span>
              </h1>
              <p>
                Your photo, minus the distractions.
                <br />
                Drop it in. Get a transparent PNG.
              </p>
            </div>
            <div className="upload-card">
              <div className="upload-icon">
                <ImagePlus size={31} strokeWidth={1.6} />
              </div>
              <Button
                className="primary-button upload-button"
                disabled={!ready}
                onClick={() => input.current?.click()}
              >
                <Upload size={20} /> Upload image
              </Button>
              <p className="drop-copy">or drop a photo anywhere</p>
              <p className="paste-copy">
                You can also paste with <kbd>Ctrl</kbd> + <kbd>V</kbd>
                <span className="mac-hint">
                  {' '}
                  / <kbd>⌘</kbd> + <kbd>V</kbd>
                </span>
              </p>
              <span className="file-hint">
                JPG, PNG, WebP · up to 25 MB / 25 MP
              </span>
              <div className="privacy-inline">
                <ShieldCheck size={16} /> Processed securely by Cloudflare.
              </div>
            </div>
            <div className="demo-section">
              <div className="demo-caption">
                <span>See what disappears.</span>
                <Button
                  variant="ghost"
                  className="text-button"
                  onClick={tryExample}
                >
                  Try this photo <ArrowUpRight size={16} />
                </Button>
              </div>
              <Comparison
                original="/example.jpg"
                result="/example-cutout.png"
                value={demoCompare}
                onChange={setDemoCompare}
                label="Example before and after"
                demo
              />
              <p className="demo-hint">
                <ChevronLeft size={14} />
                <ChevronRight size={14} /> Slide to see the difference
              </p>
            </div>
          </section>
        ) : (
          <section
            className="result-workspace"
            aria-labelledby="result-heading"
          >
            <div className="result-topline">
              <div>
                <span className="eyebrow">YOUR PHOTO, FRONT AND CENTER</span>
                <h1 id="result-heading" ref={resultHeading} tabIndex={-1}>
                  {busy
                    ? photo.preview
                      ? 'Background removed.'
                      : 'A little disappearing act…'
                    : photo.result
                      ? 'Background removed.'
                      : 'Let’s try that again.'}
                </h1>
              </div>
              <Button
                variant="ghost"
                className="reset-button"
                onClick={reset}
                aria-label={busy ? 'Cancel removal' : 'Remove this photo'}
              >
                <X size={21} />
              </Button>
            </div>
            <div className="result-grid">
              <div className="result-preview">
                <Comparison
                  original={photo.original}
                  result={photo.preview ?? photo.result}
                  value={compare}
                  onChange={(value) => {
                    cancelAnimationFrame(animationFrame.current);
                    setRevealing(false);
                    setCompare(value);
                  }}
                  label="Your photo before and after"
                  revealing={revealing}
                  processing={busy && !photo.preview}
                  width={photo.width}
                  height={photo.height}
                />
              </div>
              <aside className="result-actions">
                {busy ? (
                  <div className="processing-info">
                    <span className="processing-symbol">
                      <LoaderCircle className="spin" size={28} />
                    </span>
                    <h2>Making the cut.</h2>
                    <output className="processing-status">
                      {progress.message}
                    </output>
                    <Progress
                      value={progress.value}
                      aria-label="Background removal progress"
                      className="removal-progress"
                    />
                    <p className="small-copy">
                      Just a moment. Your full-resolution PNG is on its way.
                    </p>
                    <Button
                      variant="outline"
                      className="secondary-button"
                      onClick={reset}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : photo.result ? (
                  <>
                    <span className="success-icon">
                      <Check size={22} />
                    </span>
                    <h2>All yours.</h2>
                    <p>
                      A transparent background. <br />
                      Your original resolution.
                    </p>
                    <a
                      className="primary-button download-button"
                      href={photo.result}
                      download={downloadName}
                    >
                      <ArrowDown size={20} /> Download PNG
                    </a>
                    <span className="resolution">
                      {photo.width.toLocaleString()} ×{' '}
                      {photo.height.toLocaleString()} px · full resolution
                    </span>
                    <Button
                      variant="outline"
                      className="secondary-button"
                      onClick={() => {
                        setCompare(compare === 100 ? 0 : 100);
                        cancelAnimationFrame(animationFrame.current);
                        setRevealing(false);
                      }}
                    >
                      <RotateCcw size={16} />{' '}
                      {compare === 100 ? 'Show cutout' : 'Show original'}
                    </Button>
                    <div className="action-divider" />
                    <Button
                      variant="ghost"
                      className="text-button"
                      onClick={() => input.current?.click()}
                    >
                      <ImagePlus size={18} /> Try another photo
                    </Button>
                  </>
                ) : (
                  <>
                    <h2>Give it another go.</h2>
                    <p>You can choose another photo or retry this one.</p>
                    <Button
                      className="primary-button"
                      onClick={async () => {
                        const response = await fetch(photo.original);
                        const blob = await response.blob();
                        void start(
                          new File([blob], photo.name, {
                            type: blob.type || 'image/png',
                          }),
                        );
                      }}
                    >
                      Retry removal
                    </Button>
                    <Button
                      variant="outline"
                      className="secondary-button"
                      onClick={() => input.current?.click()}
                    >
                      Choose another photo
                    </Button>
                  </>
                )}
                <div className="privacy-inline">
                  <ShieldCheck size={16} /> No account. No watermark.
                </div>
              </aside>
            </div>
            {!busy && photo.result && (
              <p className="result-hint">
                Drag the slider to compare. Paste or drop another photo to keep
                going.
              </p>
            )}
          </section>
        )}
        {error && (
          <div className="error-message" role="alert">
            <span>{error}</span>
            <Button
              variant="ghost"
              aria-label="Dismiss error"
              onClick={() => setError('')}
            >
              <X size={17} />
            </Button>
          </div>
        )}
      </main>
      <footer className="site-footer">
        <span>Just your photo. Nothing extra.</span>
        <span>
          Free to use <span className="footer-dot">·</span> No watermarks{' '}
          <span className="footer-dot">·</span> No sign-up
        </span>
        <a href="/about">
          About & licenses <ArrowUpRight size={13} />
        </a>
      </footer>
      {dragging && (
        <div className="drop-overlay">
          <div>
            <Upload size={44} />
            <h2>Drop it like it’s background.</h2>
            <p>Release your photo to start.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Comparison({
  original,
  result,
  value,
  onChange,
  label,
  demo = false,
  revealing = false,
  processing = false,
  width = 1200,
  height = 900,
}: {
  original: string;
  result?: string;
  value: number;
  onChange: (value: number) => void;
  label: string;
  demo?: boolean;
  revealing?: boolean;
  processing?: boolean;
  width?: number;
  height?: number;
}) {
  return (
    <div
      className={`comparison checkerboard ${demo ? 'demo-comparison' : 'photo-comparison'} ${revealing ? 'revealing' : ''} ${processing ? 'processing' : ''}`}
      style={
        {
          '--split': `${value}%`,
          '--photo-ratio': `${width} / ${height}`,
        } as React.CSSProperties
      }
    >
      {result && (
        <img
          src={result}
          alt={
            demo
              ? 'Example with background removed'
              : 'Your photo with a transparent background'
          }
          className="comparison-image result-image"
          draggable={false}
        />
      )}
      <img
        src={original}
        alt={demo ? 'Original example photo' : 'Your original photo'}
        className="comparison-image original-image"
        style={{
          clipPath: result ? `inset(0 ${100 - value}% 0 0)` : undefined,
        }}
        draggable={false}
      />
      {result && (
        <>
          <span
            className="image-label before-label"
            style={{ opacity: value > 12 ? 1 : 0 }}
          >
            Original
          </span>
          <span
            className="image-label after-label"
            style={{ opacity: value < 88 ? 1 : 0 }}
          >
            Background removed
          </span>
          <div className="comparison-line" aria-hidden="true">
            <span className="comparison-handle">
              <ChevronLeft size={15} />
              <ChevronRight size={15} />
            </span>
          </div>
          <Slider
            className="comparison-slider"
            min={0}
            max={100}
            step={1}
            value={[value]}
            onValueChange={(next) =>
              onChange(Array.isArray(next) ? next[0] : next)
            }
            aria-label={label}
          />
        </>
      )}
      {processing && <div className="scan-line" aria-hidden="true" />}
    </div>
  );
}

function animateReveal(
  frame: { current: number },
  update: (value: number) => void,
  finish: () => void,
) {
  const beginning = performance.now();
  function tick(now: number) {
    const fraction = Math.min(1, (now - beginning) / 800);
    const eased =
      fraction < 0.5 ? 4 * fraction ** 3 : 1 - (-2 * fraction + 2) ** 3 / 2;
    update(100 * (1 - eased));
    if (fraction < 1) frame.current = requestAnimationFrame(tick);
    else finish();
  }
  frame.current = requestAnimationFrame(tick);
}
