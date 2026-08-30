import { PRE_PAINT_SCRIPT } from '@/app/ui/theme/prePaintScript';

/**
 * The layout the `(share)` group never had.
 *
 * `/passport/<id>` and `/card/<token>` are the two pages in this product most
 * likely to be opened on a phone belonging to someone who has never used
 * Yosemite - a boarding desk scanning a collar tag, a vet reading a shared
 * record - and they were the only route group with no theme resolution at all.
 * Nothing stamped `data-theme` on <html>, so the whole `html[data-theme='dark']`
 * block in globals.css was dead code here.
 *
 * No nonce, and none needed, but for a different reason than `(book)`: `/card`
 * and `/passport` are NOT in STRICT_CSP_PATH_PREFIXES, so they get the
 * permissive CSP variant whose script-src carries 'unsafe-inline' and
 * deliberately omits PRE_PAINT_SCRIPT_CSP_HASH (per the CSP spec a hash makes
 * the browser ignore 'unsafe-inline', which would break hydration across the
 * static marketing pages). This is the same path `(public)/layout.tsx` relies
 * on.
 *
 * The `display: contents` wrapper introduces no box. It buys `color-scheme` for
 * native controls, the app's ::selection colour, and - the reason this issue
 * was filed - the readable bone-surface inks from `body:has([data-yc-app])`.
 * Without it `--ink-faint` stayed at the marketing value #8f8984, which is
 * 3.12:1 on the passport's --screen card at font sizes down to 10.5px.
 */
export default function ShareLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_SCRIPT }} />
      <div data-yc-app style={{ display: 'contents' }}>
        {children}
      </div>
    </>
  );
}
