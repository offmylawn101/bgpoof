import type { RemovalProgress } from './removal';

type WorkerReply =
  | { type: 'progress'; message: string; value: number | null }
  | { type: 'result'; blob: Blob }
  | { type: 'preview'; blob: Blob }
  | { type: 'error'; message: string };

export function processPhoto(
  bitmap: ImageBitmap,
  signal: AbortSignal,
  progress: (next: RemovalProgress) => void,
  preview: (blob: Blob) => void,
): Promise<Blob> {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return Promise.reject(
      new Error(
        'Your browser can’t run the background remover. Try a current version of Chrome, Safari, Firefox, or Edge.',
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
        new Error(
          'This photo is taking longer than usual. Check your connection and try again.',
        ),
      );
    }, 20_000);
    signal.addEventListener('abort', cancel, { once: true });
    current.onerror = (event) => {
      console.error('Background removal worker failed:', event.message);
      cleanup();
      destroy();
      reject(
        new Error(
          'The background remover couldn’t start. Check your connection, close other tabs, and try again.',
        ),
      );
    };
    current.onmessage = ({ data }: MessageEvent<WorkerReply>) => {
      if (data.type === 'progress')
        progress({ message: data.message, value: data.value });
      else if (data.type === 'preview') preview(data.blob);
      else if (data.type === 'result') {
        cleanup();
        destroy();
        resolve(data.blob);
      } else {
        cleanup();
        destroy();
        reject(new Error(data.message));
      }
    };
    if (signal.aborted) cancel();
    else {
      try {
        current.postMessage({ bitmap }, [bitmap]);
      } catch (error) {
        cleanup();
        destroy();
        reject(error);
      }
    }
  });
}
