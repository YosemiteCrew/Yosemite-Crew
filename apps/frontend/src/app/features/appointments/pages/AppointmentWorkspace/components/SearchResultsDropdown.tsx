import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

type SearchResultsDropdownProps = {
  /** The element the dropdown is anchored to (the search input wrapper). */
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

type Position = { top: number; left: number; width: number };

const EMPTY_POSITION_SNAPSHOT = '0:0:0';

const subscribeToWindowMetrics = (onStoreChange: () => void) => {
  globalThis.window.addEventListener('resize', onStoreChange);
  globalThis.window.addEventListener('scroll', onStoreChange, true);
  return () => {
    globalThis.window.removeEventListener('resize', onStoreChange);
    globalThis.window.removeEventListener('scroll', onStoreChange, true);
  };
};

/**
 * Renders workspace search results in a body-level portal with fixed
 * positioning, anchored under the search input. Because it escapes every local
 * stacking context (cards, sticky headers, transformed rows), the results always
 * paint above the rest of the workspace — fixing dropdowns that previously hid
 * behind line-item action icons or sibling section cards. Closes on outside click
 * and on scroll/resize.
 */
const SearchResultsDropdown = ({
  anchorRef,
  open,
  onClose,
  children,
}: SearchResultsDropdownProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const positionSnapshot = useSyncExternalStore(
    subscribeToWindowMetrics,
    () => {
      if (!open || typeof document === 'undefined') return EMPTY_POSITION_SNAPSHOT;
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return EMPTY_POSITION_SNAPSHOT;
      return `${rect.bottom + 4}:${rect.left}:${rect.width}`;
    },
    () => EMPTY_POSITION_SNAPSHOT
  );
  const position =
    positionSnapshot === EMPTY_POSITION_SNAPSHOT
      ? null
      : (() => {
          const [top, left, width] = positionSnapshot.split(':').map(Number);
          return { top, left, width } satisfies Position;
        })();

  // Close when a press lands outside BOTH the anchor and the portal panel.
  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onCloseRef.current();
    };
    document.addEventListener('mousedown', handlePointerDown, { passive: true });
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return undefined;
    // Close when the page scrolls away from the anchor; internal panel scroll
    // is ignored so the list remains usable.
    const handleScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && panelRef.current?.contains(target)) return;
      onCloseRef.current();
    };
    globalThis.window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => {
      globalThis.window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [open]);

  if (!open || !position || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: position.width,
        zIndex: 1000,
      }}
      className="max-h-80 overflow-auto rounded-2xl border border-card-border bg-neutral-0 shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)]"
    >
      {children}
    </div>,
    document.body
  );
};

export default SearchResultsDropdown;
