'use client';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IoEllipsisHorizontal } from 'react-icons/io5';

export type RowMenuAction = {
  key: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  /** The row's headline action — rendered in the active treatment. */
  primary?: boolean;
  /** Draws a hairline separator above this item. */
  dividerBefore?: boolean;
};

// Row kebab: a single overflow menu standing in for a rail of icon buttons.
// Rendered through a portal so the table's overflow:hidden never clips it.
// `onOpenChange` lets the row light up while its menu is open, matching the
// design's active-row highlight.
const RowActionMenu = ({
  actions,
  label,
  onOpenChange,
}: {
  actions: RowMenuAction[];
  label: string;
  onOpenChange?: (open: boolean) => void;
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties | null>(null);
  // Guards the re-measure pass below so it only runs once per open cycle,
  // right after the panel has actually mounted and has a real height.
  const measuredRef = useRef(false);

  const changeOpen = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange]
  );

  // Positions the panel below the trigger by default. Once the panel has a
  // real height (second pass, below), flips to whichever side has more room
  // when below doesn't fully fit, and clamps the panel to that available
  // space (scrollable) so it can never run off the viewport even when
  // neither side has enough room - e.g. a menu with many actions at a short
  // viewport or high zoom (bug #1979).
  const position = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 224;
    const margin = 8;
    const left = Math.max(margin, rect.right - width);
    // scrollHeight, not offsetHeight: the first pass (before we know which way
    // to flip) can clamp the panel to a small maxHeight when there's little
    // room below. offsetHeight would then read back that shrunk box on the
    // second pass instead of the panel's true content height, corrupting the
    // flip decision and leaving the panel positioned as if it were far
    // shorter than it actually renders - overflowing the viewport regardless.
    const panelHeight = panelRef.current?.scrollHeight ?? 0;
    const spaceBelow = globalThis.window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const flipUp = panelHeight > 0 && spaceBelow < panelHeight && spaceAbove > spaceBelow;
    const availableHeight = Math.max(flipUp ? spaceAbove : spaceBelow, 80);
    const top = flipUp
      ? Math.max(margin, rect.top - Math.min(panelHeight, availableHeight) - 6)
      : rect.bottom + 6;
    setStyle({
      position: 'fixed',
      top,
      left,
      width,
      zIndex: 5000,
      maxHeight: availableHeight,
      overflowY: 'auto',
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      measuredRef.current = false;
      return;
    }
    position();
  }, [open, position]);

  // Second pass: runs after the panel above has actually mounted (style is no
  // longer null), so panelRef now reports its real height. Re-measures once so
  // the flip-up decision uses the true panel height instead of 0, then moves
  // keyboard focus into the menu so keyboard users land directly on the first
  // action instead of on an invisible portal node (bug #1979).
  useLayoutEffect(() => {
    if (!open || measuredRef.current || !panelRef.current) return;
    measuredRef.current = true;
    position();
    panelRef.current.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
  });

  // Keep the latest close action in a ref so the dismiss listeners subscribe
  // once per open (deps: [open]) instead of re-subscribing whenever the parent
  // re-creates onOpenChange.
  const closeMenuRef = useRef(() => changeOpen(false));
  closeMenuRef.current = () => changeOpen(false);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      closeMenuRef.current();
    };
    const handleScroll = () => closeMenuRef.current();
    // Escape closes and returns focus to the trigger. Tab closes the menu too
    // (it isn't a modal - trapping Tab inside it would strand keyboard users
    // who can no longer reach the rest of the page) and, deliberately, does
    // NOT preventDefault, so the browser's normal Tab order continues from
    // wherever it would have gone next.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenuRef.current();
        buttonRef.current?.focus();
        return;
      }
      if (event.key === 'Tab') {
        closeMenuRef.current();
      }
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKeyDown);
    globalThis.window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    globalThis.window.addEventListener('resize', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKeyDown);
      globalThis.window.removeEventListener('scroll', handleScroll, { capture: true });
      globalThis.window.removeEventListener('resize', handleScroll);
    };
  }, [open]);

  return (
    <div className="flex justify-center">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => changeOpen(!open)}
        className={`flex size-7 items-center justify-center rounded-[9px] transition-colors ${
          open
            ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active)]'
            : 'text-[var(--ink-faint)] hover:bg-[var(--surface-soft)] hover:text-text-primary'
        }`}
      >
        <IoEllipsisHorizontal size={16} aria-hidden="true" />
      </button>
      {open && style && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              style={style}
              className="yc-glass-overlay flex flex-col gap-px rounded-[15px] p-[7px]"
            >
              {actions.map((action, index) => {
                const dividerBefore = Boolean(action.dividerBefore) && index > 0;
                const isPrimary = Boolean(action.primary);
                return (
                  <React.Fragment key={action.key}>
                    {dividerBefore ? (
                      <span className="mx-2 my-1 h-px bg-[var(--hairline)]" aria-hidden="true" />
                    ) : null}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        action.onSelect();
                        changeOpen(false);
                      }}
                      className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-semibold transition-colors ${
                        isPrimary
                          ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active)]'
                          : 'text-text-primary hover:bg-[var(--surface-soft)]'
                      }`}
                    >
                      <span
                        className={`flex ${isPrimary ? '' : 'text-[var(--ink-faint)]'}`}
                        aria-hidden="true"
                      >
                        {action.icon}
                      </span>
                      {action.label}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </div>
  );
};

export default RowActionMenu;
