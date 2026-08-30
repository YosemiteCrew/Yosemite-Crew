import { PRE_PAINT_SCRIPT } from '@/app/ui/theme/prePaintScript';

/**
 * The layout the `(book)` group never had.
 *
 * Its absence was not cosmetic. `ThemeScript` is mounted by `(app)/layout.tsx`
 * and the raw script by `(public)/layout.tsx`; `(book)` had neither, so nothing
 * ever stamped `data-theme` on `<html>` and the whole `html[data-theme='dark']`
 * block in globals.css was dead code on this route. A pet owner on a dark phone
 * got a full-brightness bone page while every other Yosemite surface flipped.
 *
 * No nonce, and none is needed: `/book` is in STRICT_CSP_PATH_PREFIXES
 * (middleware.ts), and securityHeaders.ts adds PRE_PAINT_SCRIPT_CSP_HASH to
 * script-src in the strict variant only - which is exactly this case. The
 * public layout does the same thing for the same reason.
 *
 * The `display: contents` wrapper introduces no box, so it cannot disturb the
 * height chain under it. What it buys is `color-scheme` on the native date
 * input and checkbox (the [data-yc-app] rules are plain attribute selectors),
 * the app's ::selection colour, and the readable faint inks that
 * `body:has([data-yc-app])` scopes to bone surfaces. Nothing on these two pages
 * depends on that last one - every line that reached for --ink-faint now uses
 * --ink-muted - so a browser without :has() loses nothing.
 */
export default function BookLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_SCRIPT }} />
      <div data-yc-app style={{ display: 'contents' }}>
        {children}
      </div>
    </>
  );
}
