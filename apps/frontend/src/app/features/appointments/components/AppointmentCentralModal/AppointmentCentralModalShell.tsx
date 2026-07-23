'use client';
import React, { useId } from 'react';
import ModalBase from '@/app/ui/overlays/Modal/ModalBase';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
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
      overlayStyle={{ backgroundColor: 'var(--sh55)' }}
      containerClassName={[
        'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1200]',
        'w-[calc(100vw-24px)] sm:w-[80vw] max-w-[860px]',
        'modal-max-h bg-transparent flex flex-col',
        showModal ? 'opacity-100' : 'opacity-0 pointer-events-none',
      ].join(' ')}
    >
      <div className="modal-max-h relative flex flex-col flex-1 min-h-0 overflow-hidden rounded-[22px] bg-neutral-0 shadow-[0_40px_110px_rgba(0,0,0,0.42)]">
        {/* Full-panel loading overlay — sits above header + body */}
        {isLoading && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 rounded-[22px] bg-neutral-0">
            <YosemiteLoader label={loadingLabel} />
            <p className="text-body-4 text-text-secondary text-center">
              Finalizing your appointment…
            </p>
          </div>
        )}

        {/* Header */}
        <div className="px-4 py-3 sm:px-6 shrink-0 border-b border-card-border bg-[var(--screen)]">
          <ModalHeader
            title={title}
            titleId={titleId}
            onClose={() => {
              if (canClose && !canClose()) return;
              setShowModal(false);
              onClose?.();
            }}
          />
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hidden px-4 pb-4 pt-5 sm:px-6 sm:pb-4 sm:pt-5">
          {children}
        </div>
      </div>
    </ModalBase>
  );
};

export default AppointmentCentralModalShell;
