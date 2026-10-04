'use client';

import { useCallback, useEffect, useRef, type RefObject } from 'react';

export type Announce = (message: string) => void;

export interface Announcer {
  liveRegionRef: RefObject<HTMLOutputElement | null>;
  announce: Announce;
}

export function useAnnouncer(): Announcer {
  const liveRegionRef = useRef<HTMLOutputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const announce = useCallback<Announce>((message) => {
    const region = liveRegionRef.current;
    if (!region) return;
    region.textContent = '';
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (liveRegionRef.current) liveRegionRef.current.textContent = message;
    }, 50);
  }, []);

  return { liveRegionRef, announce };
}
