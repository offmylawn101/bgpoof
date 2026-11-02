import { turnstileSiteKey } from './site-settings';

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'error-callback': () => void;
      'timeout-callback': () => void;
    },
  ) => string;
  remove: (widget: string) => void;
};

const TOKEN_LIFETIME = 270_000; // Tokens expire after 300 seconds.
const WAIT = 8_000;
let api: Promise<TurnstileApi> | undefined;
let ready: { token: Promise<string>; created: number } | undefined;

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
async function requestToken() {
  try {
    const turnstile = await loadApi();
    return await new Promise<string>((resolve) => {
      const container = document.createElement('div');
      // Turnstile can't run under display: none, and invisible mode shows no UI.
      container.style.cssText =
        'position:fixed;width:0;height:0;overflow:hidden';
      document.body.appendChild(container);
      const finish = (token: string) => {
        turnstile.remove(widget);
        container.remove();
        resolve(token);
      };
      const widget = turnstile.render(container, {
        sitekey: turnstileSiteKey,
        callback: finish,
        'error-callback': () => finish(''),
        'timeout-callback': () => finish(''),
      });
    });
  } catch {
    return '';
  }
}

/** Starts the check early, on the first sign of an upload, to keep removal fast. */
export function prepareVerification() {
  if (!turnstileSiteKey) return;
  if (!ready || Date.now() - ready.created > TOKEN_LIFETIME)
    ready = { token: requestToken(), created: Date.now() };
}

/** Tokens are single-use, so each removal takes one and the next starts fresh. */
export async function takeVerification() {
  if (!turnstileSiteKey) return undefined;
  prepareVerification();
  const token = ready!.token;
  ready = undefined;
  return Promise.race([
    token,
    new Promise<string>((resolve) => setTimeout(resolve, WAIT, '')),
  ]);
}
