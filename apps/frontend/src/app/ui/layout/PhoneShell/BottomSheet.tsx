'use client';

import React, { useEffect, useId, useRef } from 'react';
import { IoClose } from 'react-icons/io5';

export type BottomSheetProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional footer region for full-width stacked buttons. */
  footer?: React.ReactNode;
  /** Extra class on the panel for per-sheet sizing. */
  className?: string;
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * The phone form of a modal/drawer: a bottom-anchored sheet with a 44x5 grabber,
 * a 24px top radius, a title + close row, and an optional footer for full-width
 * stacked buttons. Traps focus while open, closes on backdrop click or Escape,
 * and restores focus to the trigger on close. The close button guarantees at
 * least one focusable element, so the trap never operates on an empty set.
 */
const BottomSheet = ({ open, title, onClose, children, footer, className }: BottomSheetProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;

    const panel = panelRef.current;
    /* v8 ignore next -- the panel is always mounted while the sheet is open */
    if (!panel) return undefined;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const getFocusables = () => Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    getFocusables()[0].focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = getFocusables();
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      /* v8 ignore next -- best-effort focus restoration */
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="yc-phone-sheet-root" role="presentation">
      <button
        type="button"
        className="yc-phone-sheet-backdrop"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={`yc-phone-sheet ${className ?? ''}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <span className="yc-phone-sheet-grabber" aria-hidden />
        <div className="yc-phone-sheet-head">
          <h2 id={titleId} className="yc-phone-sheet-title">
            {title}
          </h2>
          <button
            type="button"
            className="yc-phone-sheet-close"
            onClick={onClose}
            aria-label="Close"
          >
            <IoClose size={20} aria-hidden />
          </button>
        </div>
        <div className="yc-phone-sheet-body">{children}</div>
        {footer ? <div className="yc-phone-sheet-footer">{footer}</div> : null}
      </div>
    </div>
  );
};

export default BottomSheet;
