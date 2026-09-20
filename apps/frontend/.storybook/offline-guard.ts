/**
 * Default offline guard for the Storybook preview.
 *
 * WHY THIS EXISTS
 * ---------------
 * Storybook renders the shipped components, and a lot of them fetch on mount.
 * Nothing in the preview points those calls anywhere safe:
 *
 *   - `src/app/services/axios.ts` builds its instance with
 *     `baseURL: process.env.NEXT_PUBLIC_BASE_URL`. When that variable IS set in
 *     the shell that started Storybook, every request leaves the browser for
 *     `https://devapi.yosemitecrew.com` and is refused by CORS from
 *     `http://localhost:6117`. When it is NOT set, `baseURL` is empty and the
 *     same requests hit the Storybook dev server as `/fhir/v1/...` and 404.
 *     Same story file, two different behaviours, decided by a shell variable.
 *   - `src/app/stores/authStore.ts` calls `initAuthClient()` at MODULE TOP
 *     LEVEL, so merely importing the auth store boots SuperTokens against
 *     whatever `NEXT_PUBLIC_BASE_URL` holds at that instant. SuperTokens then
 *     installs its own global `fetch`/`XMLHttpRequest` interceptors and starts
 *     firing `/auth/session/refresh` at that host for the rest of the session.
 *     Several stories legitimately write `process.env.NEXT_PUBLIC_BASE_URL` in
 *     a decorator, and `initialized` never resets - so in a runner that reuses
 *     one page across many stories, ONE story's env write decides where a later
 *     story's session refresh goes. That is the shape of the ~175-story CORS
 *     failure: it is order-dependent, and it is invisible in a runner that
 *     reloads the page per story.
 *
 * The consequence is the thing worth fixing: with ~5% of the suite failing for
 * reasons that have nothing to do with the components, nobody can read the
 * suite as a signal, and a real regression hides in the noise.
 *
 * WHAT IT DOES
 * ------------
 * Wraps the two browser primitives every one of those calls passes through -
 * `fetch` and `XMLHttpRequest.prototype.open/send` - and answers anything bound
 * for the real API offline instead of letting it leave the page. Both are
 * needed: axios picks the XHR adapter in a browser, while SuperTokens' session
 * refresh and the handful of raw-`fetch` services go through `fetch`.
 *
 * DESIGN NOTES (this is global to all 3,291 stories, so the choices are narrow
 * on purpose)
 *
 * 1. It guards the PRIMITIVES, not the app's axios instance. Guarding
 *    `api.defaults.adapter` would have been fewer lines, but 29 story files
 *    already swap `api.defaults.adapter` themselves and 19 more patch
 *    `XMLHttpRequest.prototype` - a guard on the adapter would have been the
 *    thing those stories overwrite and restore, and restoring it wrongly would
 *    silently disarm the guard for every story after them. At the primitive
 *    layer a per-story adapter swap wins by construction: axios calls the
 *    story's adapter and never reaches XHR at all. It also keeps this file free
 *    of app imports, so the preview does not drag `authStore` (and its
 *    top-level `initAuthClient()`) into every story that never wanted it.
 *
 * 2. Per-story stubs still win. The guard installs once, while the preview
 *    annotations are evaluated - before any CSF module is imported. A story
 *    that swaps `globalThis.fetch`, or captures
 *    `XMLHttpRequest.prototype.open/send` at module scope and restores them
 *    later, is capturing and restoring the GUARDED functions. Its stub sits in
 *    front of the guard while it runs, its cleanup puts the guard back, and the
 *    calls it chooses not to answer fall through to the guard instead of
 *    escaping. That "fall through to the real transport" line several stories
 *    already have now means "fall through to something offline".
 *
 * 3. The answer is an offline `404`, NOT a `200` with an empty payload. This
 *    was the one choice worth measuring rather than reasoning about, and the
 *    obvious answer is the wrong one here.
 *
 *    A `200 []` was tried first and broke three of the six stories in
 *    `AppointmentInfo/Info/AppointmentInfo.stories.tsx` on the spot ("Room:
 *    Consult 2" gone, an input with no value, a validation message that never
 *    appeared). The reason generalises to most of the suite: the established
 *    pattern here is to SEED a Zustand store in `beforeEach` and let the
 *    component's own fetch fail, so the loader `catch`es and the seeded data
 *    survives. AppointmentInfo says so in its own comment - "edit mode opens
 *    `catch`es into `timeSlots: []` ... that is what makes the edit-mode
 *    stories below deterministic without any MSW wiring". A SUCCESSFUL empty
 *    response is the one thing that defeats that: the loader takes its happy
 *    path and overwrites the seeded fixture with nothing.
 *
 *    `404` is also the status the suite is already calibrated against. With no
 *    `.env` in the preview, `baseURL` is empty today and these calls already
 *    land on the Storybook dev server as `/fhir/v1/...` and 404. So the guard
 *    does not introduce a third behaviour - it makes the behaviour every story
 *    was written against the ONLY behaviour, whether or not
 *    `NEXT_PUBLIC_BASE_URL` is set in the shell.
 *
 *    It is not an unhandled rejection either. `fetch` RESOLVES with an
 *    `ok: false` response, and the XHR fires `loadend` with a status, so axios
 *    rejects into the `catch` every one of these services already has - the
 *    same path they take today.
 *
 * 4. It answers rather than pretends the call never happened, and it logs, so
 *    an author can see which of their stories is leaning on an unmocked call.
 *
 * NOT COVERED, on purpose: `WebSocket`, `navigator.sendBeacon`, and subresource
 * loads (`<img src>`, `<script src>`), none of which go through `fetch`/XHR.
 * No story in the suite has been observed to need them, and widening the guard
 * to the whole network layer would start intercepting things Storybook itself
 * depends on.
 */

/**
 * Answered to every blocked call. See design note 3 for why this is a 404 and
 * not an empty success - a successful empty response overwrites the store
 * fixtures the suite seeds, a failed one leaves them alone.
 */
const BLOCKED_STATUS = 404;
const BLOCKED_STATUS_TEXT = 'Not Found';
const BLOCKED_BODY = JSON.stringify({
  error: 'Blocked by the Storybook offline guard - no request left the browser.',
});
const JSON_CONTENT_TYPE = 'application/json';

/**
 * Same-origin paths the Storybook dev server genuinely owns.
 *
 * The rule is an allowlist rather than a blocklist of API prefixes, because the
 * app's endpoints change every week and Storybook's own surface does not. A
 * missed API prefix would let a real call escape; a missed Storybook prefix
 * fails loudly the first time the suite is run, which is the failure that gets
 * fixed rather than the one that rots.
 *
 * `/__` covers Vite's `__vite_ping`, which the HMR client polls to decide when
 * the dev server is back after a restart. Answering it from here would freeze
 * that decision on a lie in either direction, and the preview would stop
 * picking up edits.
 */
const STORYBOOK_OWNED_PREFIXES = [
  '/index.json',
  '/iframe.html',
  '/sb-',
  '/storybook',
  '/@', // /@vite/, /@id/, /@fs/, /@react-refresh
  '/src/',
  '/node_modules/',
  '/.storybook/',
  '/virtual:',
  '/__', // /__vite_ping
  '/fonts/',
  '/images/',
  '/static/',
  '/favicon',
  '/apple-touch-icon',
  '/web-app-manifest',
  '/site.webmanifest',
];

/** Static files served from the staticDirs roots rather than from a folder. */
const ASSET_EXTENSION =
  /\.(css|js|mjs|cjs|jsx|ts|tsx|json|map|woff2?|ttf|otf|eot|png|jpe?g|gif|svg|webp|avif|ico|txt|md|mdx|html|wasm)($|\?)/i;

type GuardedXhr = XMLHttpRequest & {
  __ycGuardUrl?: string;
  __ycGuardMethod?: string;
};

let installed = false;

/**
 * Deduped by method + pathname (query deliberately dropped: a search-as-you-type
 * endpoint would otherwise print a line per keystroke and bury the signal).
 */
const reported = new Set<string>();

const resolveUrl = (target: unknown): URL | null => {
  try {
    if (typeof target === 'string') return new URL(target, globalThis.location.href);
    if (target instanceof URL) return target;
    const candidate = (target as { url?: unknown } | null)?.url;
    if (typeof candidate === 'string') return new URL(candidate, globalThis.location.href);
  } catch {
    // An address this file cannot parse is an address the network cannot reach
    // either, so it is left alone rather than guessed at.
    return null;
  }
  return null;
};

const isStorybookOwned = (url: URL): boolean => {
  // data:, blob:, filesystem: never leave the page.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return true;
  // Anything off this origin is the real internet, whatever its path looks like.
  if (url.origin !== globalThis.location.origin) return false;
  if (STORYBOOK_OWNED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return true;
  return ASSET_EXTENSION.test(url.pathname);
};

const report = (method: string, url: URL) => {
  const key = `${method} ${url.origin}${url.pathname}`;
  if (reported.has(key)) return;
  reported.add(key);
  // console.info, not warn/error: the story QA runner treats console errors as
  // failures, and an unmocked call is a note to the author, not a broken story.
  console.info(
    `[storybook offline guard] ${key} was answered offline with ${BLOCKED_STATUS}. ` +
      'This story is relying on an unmocked API call - stub it if the response matters.'
  );
};

const installFetchGuard = () => {
  // Captured once. Reading globalThis.fetch inside the wrapper would recurse
  // through whatever a story installed on top of it.
  const realFetch = globalThis.fetch.bind(globalThis);

  const guardedFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = resolveUrl(input);
    if (url === null || isStorybookOwned(url)) return realFetch(input, init);

    const method = init?.method ?? (input as Request)?.method ?? 'GET';
    report(method.toUpperCase(), url);

    // Resolved, not rejected: a rejected fetch is what CORS does today, and it
    // is the shape that turns into an unhandled rejection. Callers already
    // branch on `res.ok`.
    return Promise.resolve(
      new Response(BLOCKED_BODY, {
        status: BLOCKED_STATUS,
        statusText: BLOCKED_STATUS_TEXT,
        headers: { 'content-type': JSON_CONTENT_TYPE },
      })
    );
  };

  globalThis.fetch = guardedFetch as typeof globalThis.fetch;
};

/**
 * Hand a caller a finished 404 on a request that was never sent.
 *
 * Own data properties shadow the prototype's accessors - that is the only way
 * to write `status`/`responseText` on a real XMLHttpRequest. This mirrors the
 * technique SoapCodedTermPicker.stories.tsx and ChangeRoom.stories.tsx already
 * use, so axios's XHR adapter is being fed a shape this repo has proven it
 * accepts.
 */
const answerOffline = (xhr: XMLHttpRequest, url: URL) => {
  const define = (key: string, value: unknown) =>
    Object.defineProperty(xhr, key, { value, configurable: true });

  define('readyState', 4);
  define('status', BLOCKED_STATUS);
  define('statusText', BLOCKED_STATUS_TEXT);
  define('responseText', BLOCKED_BODY);
  define('response', BLOCKED_BODY);
  define('responseURL', url.href);
  // axios reads the header block to build `response.headers`; an unsent XHR
  // returns '' from the real method, which loses the content type and with it
  // any caller that branches on it.
  define('getAllResponseHeaders', () => `content-type: ${JSON_CONTENT_TYPE}\r\n`);

  xhr.dispatchEvent(new Event('readystatechange'));
  xhr.dispatchEvent(new ProgressEvent('load'));
  // axios settles on `onloadend`; dispatching the event runs the `on*` handler
  // as well as any addEventListener subscriber.
  xhr.dispatchEvent(new ProgressEvent('loadend'));
};

const installXhrGuard = () => {
  const realOpen = XMLHttpRequest.prototype.open;
  const realSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function guardedOpen(
    this: GuardedXhr,
    method: string,
    url: string | URL,
    isAsync?: boolean,
    username?: string | null,
    password?: string | null
  ) {
    this.__ycGuardUrl = String(url);
    this.__ycGuardMethod = String(method).toUpperCase();
    // Still opened for real: a blocked request is decided at send() time, and
    // everything the caller does between open() and send() (setRequestHeader,
    // withCredentials, timeout) has to keep working on a genuine instance.
    realOpen.call(this, method, url, isAsync ?? true, username, password);
  };

  XMLHttpRequest.prototype.send = function guardedSend(
    this: GuardedXhr,
    body?: Document | XMLHttpRequestBodyInit | null
  ) {
    const url = this.__ycGuardUrl === undefined ? null : resolveUrl(this.__ycGuardUrl);
    if (url === null || isStorybookOwned(url)) {
      realSend.call(this, body ?? null);
      return;
    }

    report(this.__ycGuardMethod ?? 'GET', url);
    // Answered on a later tick rather than inline, so a caller that attaches
    // its handlers after send() still sees the events. Callers that attach
    // before (axios does) are unaffected.
    setTimeout(() => answerOffline(this, url), 0);
  };
};

/**
 * Idempotent, browser-only. Called from `preview.ts` at module scope so it is
 * in place before the first CSF module is imported - see design note 2, the
 * ordering is what lets per-story stubs capture and restore the guard rather
 * than the pristine primitives.
 */
export const installOfflineGuard = (): void => {
  if (installed) return;
  if (globalThis.window === undefined) return;
  if (typeof globalThis.fetch !== 'function') return;
  if (typeof globalThis.XMLHttpRequest !== 'function') return;

  installed = true;
  installFetchGuard();
  installXhrGuard();
};
