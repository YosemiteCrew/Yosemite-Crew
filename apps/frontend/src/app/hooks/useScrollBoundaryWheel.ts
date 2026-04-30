'use client';
import { useCallback } from 'react';

/**
 * Returns an onWheel handler for an inner scrollable container.
 * When the wheel reaches the top/bottom boundary of the inner scroll,
 * it manually forwards the scroll delta to the nearest outer scrollable
 * ancestor so the page can continue scrolling.
 */
export const useScrollBoundaryWheel = () =>
  useCallback((e: React.WheelEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const atTop = el.scrollTop <= 0;
    const atBottom = Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 1;

    if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) {
      let parent = el.parentElement;
      while (parent) {
        const style = globalThis.window.getComputedStyle(parent);
        const overflow = style.overflowY;
        if (overflow === 'auto' || overflow === 'scroll') {
          parent.scrollTop += e.deltaY;
          break;
        }
        parent = parent.parentElement;
      }
    }
  }, []);
