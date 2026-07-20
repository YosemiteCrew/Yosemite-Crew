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

  const changeOpen = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange]
  );

  const position = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 224;
    const left = Math.max(8, rect.right - width);
    setStyle({ position: 'fixed', top: rect.bottom + 6, left, width, zIndex: 5000 });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }
    position();
  }, [open, position]);

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
    document.addEventListener('mousedown', handlePointer);
    globalThis.window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    globalThis.window.addEventListener('resize', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
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
