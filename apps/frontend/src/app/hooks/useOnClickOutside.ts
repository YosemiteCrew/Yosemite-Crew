import { useEffect, type RefObject } from 'react';

/**
 * Invoke `handler` when a pointer/touch press lands outside the referenced
 * element. Used by the workspace's inline search dropdowns so they dismiss on an
 * outside click. No-op while `enabled` is false (e.g. the dropdown is closed) so
 * idle dropdowns don't keep a document listener attached.
 */
export const useOnClickOutside = (
  ref: RefObject<HTMLElement | null>,
  handler: () => void,
  enabled = true
): void => {
  useEffect(() => {
    if (!enabled) return undefined;
    const listener = (event: MouseEvent | TouchEvent) => {
      const el = ref.current;
      if (!el || el.contains(event.target as Node)) return;
      handler();
    };
    document.addEventListener('mousedown', listener);
    // Passive: the handler only closes the dropdown, it never calls
    // preventDefault(), so the browser can keep scrolling without waiting on it.
    document.addEventListener('touchstart', listener, { passive: true });
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler, enabled]);
};
