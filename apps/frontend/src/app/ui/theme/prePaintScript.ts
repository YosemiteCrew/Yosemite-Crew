/**
 * The theme pre-paint script, and the CSP hash that authorises it.
 *
 * This runs before the app paints so dark mode never flashes: it reads the
 * explicit choice (localStorage `yc-theme`), else the OS preference, and stamps
 * `data-theme` on `<html>`.
 *
 * It is inlined by two different layouts, which is why the source lives here
 * rather than in either of them:
 *
 *  - `(routes)/(app)/layout.tsx` renders it through `ThemeScript`, which tags it
 *    with the request's nonce.
 *  - `(routes)/(public)/layout.tsx` inlines it directly, with no nonce, because
 *    public pages are statically prerendered and so have no per-request nonce to
 *    give it.
 *
 * The second case is the awkward one. A handful of `(public)` routes - the
 * credential and payment pages - opt into the strict nonce CSP via
 * `STRICT_CSP_PATH_PREFIXES`, and on those the nonce-less copy was blocked
 * outright, so the theme could not resolve before paint. Authorising it by hash
 * fixes that without a nonce, and therefore without forcing the public layout to
 * call `headers()` - which would make every marketing page render dynamically
 * and defeat static generation.
 */
export const PRE_PAINT_SCRIPT =
  "(function(){try{var s=localStorage.getItem('yc-theme');var d=s?s==='dark':matchMedia('(prefers-color-scheme:dark)').matches;document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();";
