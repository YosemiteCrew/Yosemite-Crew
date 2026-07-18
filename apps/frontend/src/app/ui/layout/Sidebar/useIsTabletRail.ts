'use client';

import { useEffect, useState } from 'react';

/**
 * Tablet band of the PIMS responsive shell. The Foundations breakpoint contract
 * is: desktop (>= 1280px) expanded 224px sidebar, tablet (768-1279px) 76px icon
 * rail, phone (< 768px) bottom tabs. Inside this band the rail is the navigation
 * and cannot be expanded, so a stored desktop "expanded" preference must not win.
 */
export const TABLET_RAIL_MEDIA_QUERY = '(min-width: 768px) and (max-width: 1279px)';

/**
 * Returns true only when the viewport is in the tablet range. Starts `false`
 * during SSR and the first client render (there is no `matchMedia` on the
 * server) so desktop never flashes a rail and there is no hydration mismatch;
 * it flips to the real value after mount.
 */
export function useIsTabletRail(query: string = TABLET_RAIL_MEDIA_QUERY): boolean {
  const [isTabletRail, setIsTabletRail] = useState(false);

  useEffect(() => {
    if (typeof globalThis.matchMedia !== 'function') return undefined;

    const mediaQueryList = globalThis.matchMedia(query);
    const update = () => setIsTabletRail(mediaQueryList.matches);

    update();
    mediaQueryList.addEventListener('change', update);
    return () => mediaQueryList.removeEventListener('change', update);
  }, [query]);

  return isTabletRail;
}

export default useIsTabletRail;
