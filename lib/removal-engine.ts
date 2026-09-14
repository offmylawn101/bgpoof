import type { RemovalProgress } from './removal';

type WorkerReply =
  | { type: 'progress'; message: string; value: number | null }
  | { type: 'result'; blob: Blob }
  | { type: 'error'; message: string };
let worker: Worker | null = null;
let releaseTimer: ReturnType<typeof setTimeout> | undefined;

export function processPhoto(
  file: File,
  signal: AbortSignal,
  progress: (next: RemovalProgress) => void,
): Promise<Blob> {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return Promise.reject(
      new Error(
        'Your browser can’t run the background remover. Try a current version of Chrome, Safari, Firefox, or Edge.',
      ),
    );
  }
  clearTimeout(releaseTimer);
  worker ??= new Worker('/removal.worker.mjs', { type: 'module' });
  const current = worker;
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', cancel);
      current.onmessage = null;
      current.onerror = null;
    };
    const destroy = () => {
      current.terminate();
      if (worker === current) worker = null;
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
          'This photo is taking too long on your device. Close other tabs and try a smaller photo.',
        ),
      );
    }, 180_000);
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
      else if (data.type === 'result') {
        cleanup();
        // Keep the model ready for another photo, then return memory to the device.
        releaseTimer = setTimeout(destroy, 120_000);
        resolve(data.blob);
      } else {
        cleanup();
        destroy();
        reject(new Error(data.message));
      }
    };
    if (signal.aborted) cancel();
    else current.postMessage({ file });
  });
}
