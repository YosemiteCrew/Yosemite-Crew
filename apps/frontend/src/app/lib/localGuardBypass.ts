import { useSyncExternalStore } from 'react';

/**
 * `NEXT_PUBLIC_DISABLE_AUTH_GUARD` lets the app shell render without a real
 * session so UI/styling work needs no login.
 *
 * The flag is `NEXT_PUBLIC_`, so its value is baked into the client bundle: a
 * build that sets it by accident ships that setting to whatever host serves the
 * bundle. The hostname check is what keeps that from mattering - the bypass can
 * only ever take effect on a local origin.
 *
 * Every consumer of the flag has to go through this helper. Reading
 * `process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD` directly re-introduces the
 * unguarded form, which is how the session initializer and the sidebar ended up
 * rendering the private shell on a deployed host while their comments claimed
 * they could not.
 */
export const isLocalGuardBypassEnabled = (): boolean => {
  if (process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD !== 'true') return false;
  const hostname = (
    process.env.YC_TEST_HOSTNAME ?? globalThis.window?.location?.hostname
  )?.toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1';
};

/* The flag half of the check is baked into the bundle, but the hostname half can
   only be read in a browser: the server has no `window`, so it resolves the
   bypass to `false` while a local client resolves it to `true`.

   Four components branch on that during render, and the difference reached the
   DOM. The server sent the sidebar's loading placeholder, `<div class="sidebar">`,
   and the client rendered the whole shell, so React threw the server HTML away
   with "Hydration failed because the server rendered HTML didn't match the
   client" on every local page load. Only local: with the flag unset the function
   returns false on both sides before it ever looks for a window.

   useSyncExternalStore is how React renders a browser-only value. It uses the
   server snapshot for SSR *and* for the hydration pass, then re-renders with the
   real one, so both sides agree on the markup React compares. `false` is the
   right snapshot to defer to because it means "guard enabled": the extra render
   is the strict one, never the bypassed one. */
const subscribeToNothing = () => () => {
  /* Nothing to unsubscribe from. The flag is baked in at build time and the
     hostname cannot change while the page is open, so the snapshot only ever
     moves once - from the server's answer to the browser's, at hydration. */
};
const guardDisabledOnTheServer = () => false;

/** Render-safe form. Anything that branches on the bypass DURING RENDER must use
 *  this rather than calling `isLocalGuardBypassEnabled` directly, or it
 *  reintroduces the mismatch above. Effects, event handlers and non-React code
 *  can keep calling the plain function - they run only on the client. */
export const useLocalGuardBypass = (): boolean =>
  useSyncExternalStore(subscribeToNothing, isLocalGuardBypassEnabled, guardDisabledOnTheServer);
