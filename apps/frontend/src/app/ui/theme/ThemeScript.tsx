import { headers } from 'next/headers';

const NONCE_HEADER = 'x-nonce';

/**
 * Resolve the theme before the app content paints so dark mode never flashes.
 * Reads the explicit choice (localStorage 'yc-theme') else the OS preference and
 * stamps `data-theme` on <html>.
 *
 * App routes run under a strict, per-request nonce CSP (see middleware.ts), so this
 * inline script is tagged with that request's nonce rather than relying on
 * 'unsafe-inline'. Marketing/public routes use their own inline variant.
 */
const PRE_PAINT_SCRIPT =
  "(function(){try{var s=localStorage.getItem('yc-theme');var d=s?s==='dark':matchMedia('(prefers-color-scheme:dark)').matches;document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();";

export default async function ThemeScript() {
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined;
  // The browser strips the nonce attribute from the DOM after applying the CSP,
  // so React's hydration would otherwise flag a server/client mismatch on it.
  // The script has already executed (pre-paint) with a valid nonce by then.
  return (
    <script
      nonce={nonce}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: PRE_PAINT_SCRIPT }}
    />
  );
}
