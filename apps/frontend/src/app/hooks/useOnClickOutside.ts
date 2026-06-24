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
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler, enabled]);
};
