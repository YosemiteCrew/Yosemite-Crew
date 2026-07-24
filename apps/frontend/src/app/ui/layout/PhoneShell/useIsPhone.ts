'use client';

import { useEffect, useState } from 'react';

/**
 * Phone breakpoint for the PIMS responsive shell. Below this width the app
 * swaps the sidebar/desktop header for the bottom tab bar + FAB + bottom-sheet
 * navigation. 767px keeps the 768px tablet icon-rail experience untouched.
 */
export const PHONE_MEDIA_QUERY = '(max-width: 767px)';

/**
 * Returns true only when the viewport is in the phone range. Starts `false`
 * during SSR and the first client render (there is no `matchMedia` on the
 * server) so the phone shell never renders on desktop/tablet and never causes a
 * hydration mismatch; it flips to the real value after mount.
 */
export function useIsPhone(query: string = PHONE_MEDIA_QUERY): boolean {
  const [isPhone, setIsPhone] = useState(false);

  useEffect(() => {
    if (typeof globalThis.matchMedia !== 'function') return undefined;

    const mediaQueryList = globalThis.matchMedia(query);
    const update = () => setIsPhone(mediaQueryList.matches);

    update();
    mediaQueryList.addEventListener('change', update);
    return () => mediaQueryList.removeEventListener('change', update);
  }, [query]);

  return isPhone;
}

export default useIsPhone;
