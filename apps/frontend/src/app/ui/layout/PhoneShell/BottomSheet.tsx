'use client';

import React, { useEffect, useId, useRef } from 'react';

import SheetChrome from '@/app/ui/overlays/Sheet/SheetChrome';

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
 *
 * The chrome itself (grabber, title row, body, footer) comes from the shared
 * `overlays/Sheet/SheetChrome`, which `overlays/Modal` also uses for the phone
 * form of a modal.
 */
const BottomSheet = ({ open, title, onClose, children, footer, className }: BottomSheetProps) => {
  const panelRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Keep the latest `onClose` in a ref so the focus-trap effect can depend only
  // on `open` and never re-run (re-attach listeners) when the parent re-renders.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

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
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = getFocusables();
      const first = items[0];
      const last = items.at(-1)!;
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
  }, [open]);

  if (!open) return null;

  return (
    <div className="yc-phone-sheet-root">
      {/* Not a button: Escape and the chrome's close chip are the accessible
          ways out, so a second control named "Close" only duplicated that name
          in the accessibility tree (and forced tests to disambiguate). Hidden
          from it entirely; the click keeps tap-outside-to-dismiss. */}
      <div className="yc-phone-sheet-backdrop" aria-hidden="true" onClick={onClose} />
      <dialog
        open
        ref={panelRef}
        className={`yc-phone-sheet ${className ?? ''}`.trim()}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <SheetChrome title={title} titleId={titleId} onClose={onClose} footer={footer}>
          {children}
        </SheetChrome>
      </dialog>
    </div>
  );
};

export default BottomSheet;
