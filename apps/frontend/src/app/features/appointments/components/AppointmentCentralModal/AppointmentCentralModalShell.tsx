import React, { useId } from 'react';
import ModalBase from '@/app/ui/overlays/Modal/ModalBase';
import { IoClose } from 'react-icons/io5';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';

type AppointmentCentralModalShellProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  title: string;
  canClose?: () => boolean;
  onClose?: () => void;
  children: React.ReactNode;
  /** When true, renders a full-panel loading overlay above header + body */
  isLoading?: boolean;
  loadingLabel?: string;
};

const isDatepickerTarget = (target: HTMLElement | null) =>
  Boolean(
    target?.closest(
      '.react-datepicker, .react-datepicker-popper, .yc-datepicker-calendar, .yc-datepicker-popper, [data-portal-dropdown]'
    )
  );

const AppointmentCentralModalShell = ({
  showModal,
  setShowModal,
  title,
  canClose,
  onClose,
  children,
  isLoading = false,
  loadingLabel = 'Booking appointment',
}: AppointmentCentralModalShellProps) => {
  const titleId = useId();

  return (
    <ModalBase
      showModal={showModal}
      setShowModal={setShowModal}
      canClose={canClose}
      onClose={onClose}
      aria-labelledby={titleId}
      ignoreOutsideClick={isDatepickerTarget}
      overlayClassName={`fixed inset-0 z-[1100] backdrop-blur-[2px] transition-opacity duration-200 ease-in-out ${
        showModal ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      overlayStyle={{ backgroundColor: 'var(--color-overlay-backdrop)' }}
      containerClassName={[
        'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1200]',
        'w-[calc(100vw-24px)] sm:w-[75vw] max-w-[900px]',
        'max-h-[calc(100dvh-24px)] sm:max-h-[calc(100dvh-32px)]',
        'bg-transparent flex flex-col',
        showModal ? 'opacity-100' : 'opacity-0 pointer-events-none',
      ].join(' ')}
    >
      <div
        className="relative flex flex-col flex-1 min-h-0 max-h-[calc(100dvh-24px)] sm:max-h-[calc(100dvh-32px)] overflow-hidden rounded-3xl border border-card-border shadow-2xl"
        style={{ background: 'var(--color-neutral-0)' }}
      >
        {/* Full-panel loading overlay — sits above header + body */}
        {isLoading && (
          <div
            className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 rounded-3xl"
            style={{ background: 'var(--color-neutral-0)' }}
          >
            <YosemiteLoader label={loadingLabel} />
            <p
              className="text-body-4 text-text-secondary text-center"
              style={{ fontFamily: 'var(--font-satoshi), sans-serif' }}
            >
              Finalizing your appointment…
            </p>
          </div>
        )}

        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 sm:px-6 shrink-0 border-b border-card-border"
          style={{ background: 'var(--Neutrals-Neutral-100, #FAF8F6)' }}
        >
          <div className="flex-1" />
          <h2
            id={titleId}
            className="flex-1 text-center"
            style={{
              fontFamily: 'var(--font-satoshi), sans-serif',
              fontSize: 24,
              fontWeight: 500,
              lineHeight: '120%',
              letterSpacing: '-0.48px',
              color: 'var(--color-neutral-900)',
            }}
          >
            {title}
          </h2>
          <div className="flex-1 flex justify-end">
            <button
              type="button"
              aria-label="Close"
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-card-hover transition-colors"
              onClick={() => {
                if (canClose && !canClose()) return;
                setShowModal(false);
                onClose?.();
              }}
            >
              <IoClose size={20} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hidden px-4 pb-4 pt-5 sm:px-6 sm:pb-6 sm:pt-5">
          {children}
        </div>
      </div>
    </ModalBase>
  );
};

export default AppointmentCentralModalShell;
