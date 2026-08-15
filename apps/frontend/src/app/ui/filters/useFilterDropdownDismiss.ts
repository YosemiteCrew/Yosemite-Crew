import { useEffect, type RefObject } from 'react';

/**
 * Dismisses an anchored dropdown panel: closes it on any mousedown that lands
 * outside both the trigger and the panel, and on any scroll (captured, so
 * nested scroll containers dismiss it too). No-op while `open` is false so
 * idle dropdowns don't keep listeners attached.
 */
export const useFilterDropdownDismiss = (
  open: boolean,
  setOpen: (open: boolean) => void,
  triggerRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>
): void => {
  useEffect(() => {
    if (!open) return;
    const handleClose = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      )
        return;
      setOpen(false);
    };
    const handleScroll = () => setOpen(false);
    document.addEventListener('mousedown', handleClose);
    globalThis.window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener('mousedown', handleClose);
      globalThis.window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [open, setOpen, triggerRef, panelRef]);
};
