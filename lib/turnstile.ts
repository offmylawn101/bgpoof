import { turnstileSiteKey } from './site-settings';

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      appearance: 'interaction-only';
      callback: (token: string) => void;
      'error-callback': (code: string) => boolean;
      'before-interactive-callback': () => void;
    },
  ) => string;
  remove: (widget: string) => void;
};

const TOKEN_LIFETIME = 270_000; // Tokens expire after 300 seconds.
// The server rejects a missing token, so outlast Turnstile's own retries (every 8 s).
const WAIT = 30_000;
const CHECKBOX_WAIT = 300_000;
let api: Promise<TurnstileApi> | undefined;
let ready:
  | { token: Promise<string>; created: number; stop: () => void }
  | undefined;

function loadApi() {
  api ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.onload = () =>
      resolve((window as unknown as { turnstile: TurnstileApi }).turnstile);
    script.onerror = () => {
      api = undefined;
      reject(new Error('Turnstile failed to load.'));
    };
    document.head.appendChild(script);
  });
  return api;
}

// A missing token is reported to the server as unverified, so this never rejects.
function requestToken() {
  let stop = () => {};
  const token = loadApi().then(
    (turnstile) =>
      new Promise<string>((resolve) => {
        const container = document.createElement('div');
        // On screen, because Turnstile shows a checkbox here when it can't decide alone.
        container.style.cssText =
          'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);width:max-content;z-index:200';
        document.body.appendChild(container);
        let timer = setTimeout(() => finish(''), WAIT);
        const finish = (token: string) => {
          clearTimeout(timer);
          stop = () => {};
          turnstile.remove(widget);
          container.remove();
          resolve(token);
        };
        stop = () => finish('');
        const widget = turnstile.render(container, {
          sitekey: turnstileSiteKey,
          appearance: 'interaction-only',
          callback: finish,
          // Turnstile retries on its own; only a configuration error (110xxx) is final.
          'error-callback': (code) => {
            // Deferred: render() may report this before it has returned the widget.
            if (String(code).startsWith('110'))
              queueMicrotask(() => finish(''));
            return true;
          },
          'before-interactive-callback': () => {
            clearTimeout(timer);
            timer = setTimeout(() => finish(''), CHECKBOX_WAIT);
          },
        });
      }),
    () => '',
  );
  return { token, created: Date.now(), stop: () => stop() };
}

/** Starts the check early, on the first sign of an upload, to keep removal fast. */
export function prepareVerification() {
  if (!turnstileSiteKey) return;
  if (ready && Date.now() - ready.created <= TOKEN_LIFETIME) return;
  ready?.stop();
  const check = requestToken();
  ready = check;
  // A failed early check shouldn't fail the removal; the next one starts over.
  void check.token.then((token) => {
    if (!token && ready === check) ready = undefined;
  });
}

/** Tokens are single-use, so each removal takes one and the next starts fresh. */
export async function takeVerification() {
  if (!turnstileSiteKey) return undefined;
  prepareVerification();
  const { token } = ready!;
  ready = undefined;
  return token;
}
