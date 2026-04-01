import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

type ModalBaseProps = {
  children: React.ReactNode;
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  onClose?: () => void;
  /** Return false to block closing. */
  canClose?: () => boolean;
  overlayClassName: string;
  containerClassName: string;
  ignoreOutsideClick?: (target: HTMLElement | null) => boolean;
  /**
   * Accessible label for the dialog.
   * Prefer using aria-labelledby pointing to a visible heading inside the modal.
   * aria-label is a fallback when no visible heading exists.
   */
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
};

/** Focusable element selectors used for focus-trap logic. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const ModalBase = ({
  children,
  showModal,
  setShowModal,
  onClose,
  canClose,
  overlayClassName,
  containerClassName,
  ignoreOutsideClick,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}: ModalBaseProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  /** Tracks the element focused before the modal opened so we can restore it. */
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const closeModal = useCallback(() => {
    if (canClose && !canClose()) return;
    setShowModal(false);
    onClose?.();
  }, [canClose, setShowModal, onClose]);

  // Focus management: move focus into modal on open, restore on close.
  useEffect(() => {
    if (showModal) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      const firstFocusable = containerRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      firstFocusable?.focus();
    } else {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    }
  }, [showModal]);

  // Outside-click handler.
  useEffect(() => {
    if (!showModal) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (ignoreOutsideClick?.(target)) return;
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeModal();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showModal, closeModal, ignoreOutsideClick]);

  // Escape key handler.
  useEffect(() => {
    if (!showModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeModal();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showModal, closeModal]);

  // Focus trap: keep focus inside the modal while it is open.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !containerRef.current) return;
    const focusables = Array.from(containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* Backdrop — purely visual; click-outside is handled via mousedown listener */}
      <div className={overlayClassName} aria-hidden="true" />

      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        className={containerClassName}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </>,
    document.body
  );
};

export default ModalBase;
