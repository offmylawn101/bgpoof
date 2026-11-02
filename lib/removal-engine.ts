import type { RemovalProgress } from './removal';

type WorkerReply =
  | ({ type: 'progress' } & RemovalProgress)
  | { type: 'result'; blob: Blob }
  | { type: 'preview'; blob: Blob }
  | { type: 'error'; message: string; reason?: string };

export function processPhoto(
  bitmap: ImageBitmap,
  signal: AbortSignal,
  progress: (next: RemovalProgress) => void,
  preview: (blob: Blob) => void,
  source?: Blob,
  verification?: string,
): Promise<Blob> {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return Promise.reject(
      Object.assign(
        new Error(
          'Your browser can’t run the background remover. Try a current version of Chrome, Safari, Firefox, or Edge.',
        ),
        { reason: 'unsupported' },
      ),
    );
  }
  const current = new Worker('/removal.worker.mjs', { type: 'module' });
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', cancel);
      current.onmessage = null;
      current.onerror = null;
    };
    const destroy = () => {
      current.terminate();
    };
    const cancel = () => {
      cleanup();
      destroy();
      reject(new DOMException('Removal cancelled', 'AbortError'));
    };
    const timeout = setTimeout(() => {
      cleanup();
      destroy();
      reject(
        Object.assign(
          new Error(
            'This photo is taking longer than usual. Check your connection and try again.',
          ),
          { reason: 'job_timeout' },
        ),
      );
    }, 20_000);
    signal.addEventListener('abort', cancel, { once: true });
    current.onerror = (event) => {
      console.error('Background removal worker failed:', event.message);
      cleanup();
      destroy();
      reject(
        Object.assign(
          new Error(
            'The background remover couldn’t start. Check your connection, close other tabs, and try again.',
          ),
          { reason: 'worker_start' },
        ),
      );
    };
    current.onmessage = ({ data }: MessageEvent<WorkerReply>) => {
      if (data.type === 'progress')
        progress({ message: data.message, refinement: data.refinement });
      else if (data.type === 'preview') preview(data.blob);
      else if (data.type === 'result') {
        cleanup();
        destroy();
        resolve(data.blob);
      } else {
        cleanup();
        destroy();
        reject(Object.assign(new Error(data.message), { reason: data.reason }));
      }
    };
    if (signal.aborted) cancel();
    else {
      try {
        current.postMessage({ bitmap, source, verification }, [bitmap]);
      } catch (error) {
        cleanup();
        destroy();
        reject(error);
      }
    }
  });
}
