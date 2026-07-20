import React from 'react';
import ModalBase from '@/app/ui/overlays/Modal/ModalBase';
import SheetChrome from '@/app/ui/overlays/Sheet/SheetChrome';
import useIsPhone from '@/app/ui/layout/PhoneShell/useIsPhone';

/**
 * Panel layout for the shared Modal on tablet (768-1279px) and desktop (>= 1280px).
 * - `drawer` (default): right-side full-height drawer — the behaviour every existing
 *   caller has always used. Left untouched so opting in never regresses a current screen.
 * - `centered`: centered dialog panel per the PIMS Modal recipe (backdrop var(--sh55),
 *   radius 20, widths sm 480 / md 640 / lg 840). Opt-in only.
 *
 * On phones (< 768px) both variants are re-formed per the Foundations adaptation rule
 * "Modals -> bottom sheets. Phones get a grabber, top radius 24, full-width buttons;
 * drawers go full-screen" — `centered` becomes a bottom sheet, `drawer` goes full-screen.
 * Callers pass nothing extra: the swap happens here, so all 26 call sites follow.
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

/** Opacity fade shared by every overlay and the centered panel. */
const fadeClass = (showModal: boolean): string =>
  showModal ? 'opacity-100' : 'opacity-0 pointer-events-none';

/** Right-side drawer slide. */
const drawerSlideClass = (showModal: boolean): string =>
  showModal ? 'translate-x-0' : 'translate-x-[120%]';

/** Phone panel: `centered` re-forms into a bottom sheet, `drawer` goes full-screen. */
const phonePanelClass = (isSheet: boolean, showModal: boolean): string => {
  if (isSheet) {
    return `yc-phone-sheet yc-modal-sheet ${showModal ? '' : 'yc-modal-sheet-closed'}`;
  }
  return `yc-modal-fullscreen ${showModal ? '' : 'yc-modal-fullscreen-closed'}`;
};

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
  // `false` during SSR and the first client render, so the tablet/desktop markup
  // below is what renders everywhere until the phone media query is measured.
  const isPhone = useIsPhone();

  if (isPhone) {
    const isSheet = variant === 'centered';
    const panelClassName = phonePanelClass(isSheet, showModal);

    return (
      <ModalBase
        showModal={showModal}
        setShowModal={setShowModal}
        onClose={onClose}
        canClose={canClose}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        ignoreOutsideClick={isIgnoredOutsideTarget}
        overlayClassName={`fixed backdrop-blur-[6px] inset-0 z-[1100] transition-opacity duration-300 ease-in-out motion-reduce:transition-none ${fadeClass(
          showModal
        )}`}
        overlayStyle={{ backgroundColor: 'var(--sh55)' }}
        containerClassName={panelClassName}
      >
        {/* The sheet gets the grabber; its title/close row is left to the caller's
            own header so the two never double up. The full-screen drawer has no
            sheet edge, so it takes the caller's content as-is. */}
        {isSheet ? <SheetChrome>{children}</SheetChrome> : children}
      </ModalBase>
    );
  }

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
        overlayClassName={`fixed backdrop-blur-[6px] inset-0 z-[1100] transition-opacity duration-300 ease-in-out ${fadeClass(
          showModal
        )}`}
        overlayStyle={{ backgroundColor: 'var(--sh55)' }}
        containerClassName={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-3
        flex flex-col overflow-hidden max-h-[calc(100%-1.5rem)]
        w-[calc(100%-1.5rem)] ${CENTERED_WIDTHS[size]}
        bg-neutral-0 border border-card-border rounded-[20px] z-[1200]
        shadow-[0_8px_20px_var(--sh10),0_36px_90px_var(--sh12)]
        transition-opacity duration-300 ease-in-out
        ${fadeClass(showModal)}`}
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
      overlayClassName={`fixed backdrop-blur-[2px] inset-0 z-[1100] transition-opacity duration-300 ease-in-out ${fadeClass(
        showModal
      )}`}
      overlayStyle={{ backgroundColor: 'var(--color-overlay-backdrop)' }}
      containerClassName={`fixed top-0 right-0 bottom-0 m-3 p-3 h-[calc(100%-2rem)] w-[calc(100%-2rem)] sm:w-[530px]
        bg-neutral-0 border border-card-border rounded-2xl z-[1200]
        shadow-[0_8px_20px_var(--sh10),0_36px_90px_var(--sh12)]
        transition-transform duration-300 ease-in-out
        ${drawerSlideClass(showModal)}`}
    >
      {children}
    </ModalBase>
  );
};

export default Modal;
