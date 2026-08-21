import { headers } from 'next/headers';

import { PRE_PAINT_SCRIPT } from '@/app/ui/theme/prePaintScript';

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
