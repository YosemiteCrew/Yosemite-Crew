'use client';

import { useEffect, useState } from 'react';

/**
 * Tablet band for the appointments calendar. The responsive contract is:
 * phone (< 768px) gets the purpose-built rails, tablet (768–1023px) keeps a real
 * seven-day grid under a condensed toolbar, and desktop (>= 1024px) is untouched.
 *
 * This is deliberately narrower than the shell's `TABLET_RAIL_MEDIA_QUERY`
 * (768–1279): the icon rail and the calendar chrome are different questions, and
 * the calendar frame that was signed off stops at 1023.
 */
export const TABLET_CALENDAR_MEDIA_QUERY = '(min-width: 768px) and (max-width: 1023px)';

/**
 * Returns true only inside the tablet band. Starts `false` during SSR and the
 * first client render (there is no `matchMedia` on the server) so desktop never
 * flashes the tablet toolbar and there is no hydration mismatch; it flips to the
 * real value after mount.
 */
export function useIsTabletCalendar(query: string = TABLET_CALENDAR_MEDIA_QUERY): boolean {
  const [isTabletCalendar, setIsTabletCalendar] = useState(false);

  useEffect(() => {
    if (typeof globalThis.matchMedia !== 'function') return undefined;

    const mediaQueryList = globalThis.matchMedia(query);
    const update = () => setIsTabletCalendar(mediaQueryList.matches);

    update();
    mediaQueryList.addEventListener('change', update);
    return () => mediaQueryList.removeEventListener('change', update);
  }, [query]);

  return isTabletCalendar;
}

export default useIsTabletCalendar;
