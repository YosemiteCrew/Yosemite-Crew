import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DROPDOWN_MAX_HEIGHT, DROPDOWN_MIN_HEIGHT } from './dropdownHelpers';

type UseDropdownPositioningArgs = {
  open: boolean;
  portal: boolean;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  onOuterScrollDismiss: () => void;
  /** Gap between the trigger's bottom edge and the panel; defaults to a 1px overlap. */
  topOffset?: number;
};

/**
 * Extracted from Dropdown: owns the portal-positioned panel's floating style
 * (recomputed on open, on window resize, and dismissed when the page scrolls
 * outside the portal panel). Pure structural extraction, behavior unchanged.
 */
export function useDropdownPositioning({
  open,
  portal,
  dropdownRef,
  onOuterScrollDismiss,
  topOffset = -1,
}: UseDropdownPositioningArgs) {
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties | null>(null);

  const computePortalStyle = useCallback(() => {
    /* v8 ignore next 2 -- dropdownRef is always mounted while the dropdown is open (computePortalStyle only runs behind an `open` guard), so getBoundingClientRect never returns undefined */
    const rect = dropdownRef.current?.getBoundingClientRect();
    if (!rect) return;
    const viewportHeight = globalThis.window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const panelMaxHeight = Math.min(
      DROPDOWN_MAX_HEIGHT,
      Math.max(DROPDOWN_MIN_HEIGHT, spaceBelow - 8)
    );
    setPortalStyle({
      position: 'absolute',
      left: rect.left + globalThis.window.scrollX,
      width: rect.width,
      top: rect.bottom + globalThis.window.scrollY + topOffset,
      maxHeight: panelMaxHeight,
      zIndex: 5000,
    });
  }, [dropdownRef, topOffset]);

  const computePortalStyleRef = useRef(computePortalStyle);
  useLayoutEffect(() => {
    computePortalStyleRef.current = computePortalStyle;
  });

  // Clear the floating style the moment the panel closes (render-time adjust,
  // guarded so it only fires when open/portal actually change).
  const [prevOpenPortal, setPrevOpenPortal] = useState({ open, portal });
  if (prevOpenPortal.open !== open || prevOpenPortal.portal !== portal) {
    setPrevOpenPortal({ open, portal });
    if (!open || !portal) setPortalStyle(null);
  }

  useLayoutEffect(() => {
    if (!open || !portal) return;
    computePortalStyleRef.current();
  }, [open, portal]);

  useEffect(() => {
    if (!open || !portal) return;
    const stableResize = () => computePortalStyleRef.current();
    const handleOuterScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('[data-portal-dropdown]')) return;
      onOuterScrollDismiss();
    };
    globalThis.window.addEventListener('resize', stableResize);
    globalThis.window.addEventListener('scroll', handleOuterScroll, true);
    return () => {
      globalThis.window.removeEventListener('resize', stableResize);
      globalThis.window.removeEventListener('scroll', handleOuterScroll, true);
    };
  }, [open, portal, onOuterScrollDismiss]);

  return { portalStyle };
}
