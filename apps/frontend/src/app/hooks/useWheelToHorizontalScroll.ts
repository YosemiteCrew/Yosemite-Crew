'use client';
import { useCallback } from 'react';

/**
 * Returns an onWheel handler that converts vertical mouse wheel delta into
 * horizontal scrolling. Use on containers that only scroll horizontally — the
 * handler prevents the default vertical scroll and applies deltaY as deltaX so
 * mouse wheel works without a horizontal scroll device.
 */
export const useWheelToHorizontalScroll = () =>
  useCallback((e: React.WheelEvent<HTMLElement>) => {
    if (e.deltaY === 0) return;
    e.preventDefault();
    e.currentTarget.scrollLeft += e.deltaY;
  }, []);
