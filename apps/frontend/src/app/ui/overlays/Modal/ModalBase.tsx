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
  overlayStyle?: React.CSSProperties;
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
  overlayStyle,
  containerClassName,
  ignoreOutsideClick,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}: ModalBaseProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  // React 19 owns the inert attribute via this boolean prop (true = inert, undefined = not inert).
  // Never mix with imperative setAttribute to avoid the empty-string boolean warning.
  // Derived directly from showModal — no need to copy it into state and sync it in an effect.
  const isInert = !showModal;

  const closeModal = useCallback(() => {
    if (canClose && !canClose()) return;
    setShowModal(false);
    onClose?.();
  }, [canClose, setShowModal, onClose]);

  const closeModalRef = useRef(closeModal);
  closeModalRef.current = closeModal;

  const ignoreOutsideClickRef = useRef(ignoreOutsideClick);
  ignoreOutsideClickRef.current = ignoreOutsideClick;

  // Sync inert state and body scroll lock with showModal.
  // Focus is moved in a separate effect that fires after isInert settles (below).
  useEffect(() => {
    if (showModal) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      const scrollbarWidth =
        globalThis.window === undefined
          ? 0
          : globalThis.window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollbarWidth}px`;
      // Safari requires overflow:hidden on <html> to prevent body scroll
      document.documentElement.style.overflow = 'hidden';
    } else {
      // Restore focus to the element that was active before the modal opened.
      // This runs before inert is applied to the DOM (React batches the state update),
      // so the focused element is already outside the modal when inert renders.
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
      document.documentElement.style.overflow = '';
    }
  }, [showModal]);

  // Move focus into the modal after inert is removed (i.e. after the open render).
  useEffect(() => {
    if (isInert) return;
    const el = containerRef.current;
    const firstFocusable = el?.querySelector<HTMLElement>(FOCUSABLE);
    if (firstFocusable) {
      firstFocusable.focus();
    } else {
      el?.focus();
    }
  }, [isInert]);

  // Outside-click handler.
  useEffect(() => {
    if (!showModal) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (ignoreOutsideClickRef.current?.(target)) return;
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeModalRef.current();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showModal]);

  // Escape key handler.
  useEffect(() => {
    if (!showModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeModalRef.current();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showModal]);

  // Focus trap: keep focus inside the modal while it is open.
  useEffect(() => {
    if (!showModal) return;
    const handleTabTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !containerRef.current) return;
      const focusables = Array.from(containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables.at(-1);
      if (!last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleTabTrap);
    return () => document.removeEventListener('keydown', handleTabTrap);
  }, [showModal]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* Backdrop — purely visual; click-outside is handled via mousedown listener */}
      <div className={overlayClassName} style={overlayStyle} aria-hidden="true" />

      <div
        role="dialog"
        ref={containerRef}
        aria-modal={showModal ? 'true' : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        tabIndex={-1}
        inert={isInert || undefined}
        className={`${containerClassName} ${showModal ? '' : 'pointer-events-none'}`}
      >
        {children}
      </div>
    </>,
    document.body
  );
};

export default ModalBase;
