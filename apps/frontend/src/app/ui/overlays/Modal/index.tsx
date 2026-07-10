import React from 'react';
import ModalBase from '@/app/ui/overlays/Modal/ModalBase';

/**
 * Panel layout for the shared Modal.
 * - `drawer` (default): right-side full-height drawer — the behaviour every existing
 *   caller has always used. Left untouched so opting in never regresses a current screen.
 * - `centered`: centered dialog panel per the PIMS Modal recipe (backdrop var(--sh55),
 *   radius 20, widths sm 480 / md 640 / lg 840). Opt-in only.
 */
type ModalVariant = 'drawer' | 'centered';
type ModalSize = 'sm' | 'md' | 'lg';

type ModalProps = {
  children: React.ReactNode;
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  onClose?: () => void;
  canClose?: () => boolean;
  /** Defaults to the current right-side drawer. Pass `centered` to opt into the centered panel. */
  variant?: ModalVariant;
  /** Centered-panel width. Ignored for the drawer. */
  size?: ModalSize;
  'aria-label'?: string;
  'aria-labelledby'?: string;
};

/** Centered-panel widths from the Modal recipe (sm 480 / md 640 / lg 840). */
const CENTERED_WIDTHS: Record<ModalSize, string> = {
  sm: 'sm:w-[480px]',
  md: 'sm:w-[640px]',
  lg: 'sm:w-[840px]',
};

/**
 * Outside-click targets that must never close the modal (portaled dropdowns, datepickers,
 * signing overlay). Shared by both variants so behaviour is identical.
 */
const isIgnoredOutsideTarget = (target: HTMLElement | null) =>
  Boolean(
    target?.closest(
      "[data-signing-overlay='true'], [data-portal-dropdown], .react-datepicker, .react-datepicker-popper, .yc-datepicker-calendar, .yc-datepicker-popper"
    )
  );

const Modal = ({
  children,
  showModal,
  setShowModal,
  onClose,
  canClose,
  variant = 'drawer',
  size = 'md',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: ModalProps) => {
  if (variant === 'centered') {
    return (
      <ModalBase
        showModal={showModal}
        setShowModal={setShowModal}
        onClose={onClose}
        canClose={canClose}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        ignoreOutsideClick={isIgnoredOutsideTarget}
        overlayClassName={`fixed backdrop-blur-[2px] inset-0 z-[1100] transition-opacity duration-300 ease-in-out ${
          showModal ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        overlayStyle={{ backgroundColor: 'var(--sh55)' }}
        containerClassName={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-3
        flex flex-col overflow-hidden max-h-[calc(100%-1.5rem)]
        w-[calc(100%-1.5rem)] ${CENTERED_WIDTHS[size]}
        bg-neutral-0 border border-card-border rounded-[20px] z-[1200]
        transition-opacity duration-300 ease-in-out
        ${showModal ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        {children}
      </ModalBase>
    );
  }

  return (
    <ModalBase
      showModal={showModal}
      setShowModal={setShowModal}
      onClose={onClose}
      canClose={canClose}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      ignoreOutsideClick={isIgnoredOutsideTarget}
      overlayClassName={`fixed backdrop-blur-[2px] inset-0 z-[1100] transition-opacity duration-300 ease-in-out ${
        showModal ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      overlayStyle={{ backgroundColor: 'var(--color-overlay-backdrop)' }}
      containerClassName={`fixed top-0 right-0 bottom-0 m-3 p-3 h-[calc(100%-2rem)] w-[calc(100%-2rem)] sm:w-[530px]
        bg-neutral-0 border border-card-border rounded-2xl z-[1200]
        transition-transform duration-300 ease-in-out
        ${showModal ? 'translate-x-0' : 'translate-x-[120%]'}`}
    >
      {children}
    </ModalBase>
  );
};

export default Modal;
