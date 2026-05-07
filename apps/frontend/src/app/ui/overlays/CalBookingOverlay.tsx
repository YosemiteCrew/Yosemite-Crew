'use client';
import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import Close from '@/app/ui/primitives/Icons/Close';
import ModalBase from '@/app/ui/overlays/Modal/ModalBase';

const Cal = dynamic(() => import('@calcom/embed-react'), { ssr: false });

type CalBookingOverlayProps = {
  open: boolean;
  onClose: () => void;
};

const CalBookingOverlay = ({ open, onClose }: CalBookingOverlayProps) => {
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { getCalApi } = await import('@calcom/embed-react');
      const cal = await getCalApi({ namespace: '30min' });
      cal('ui', { hideEventTypeDetails: false, layout: 'month_view' });
    })();
  }, [open]);

  if (typeof document === 'undefined') return null;

  return (
    <ModalBase
      showModal={open}
      setShowModal={(nextValue) => {
        if (!nextValue) onClose();
      }}
      onClose={onClose}
      aria-label="Book onboarding call"
      overlayClassName={`fixed inset-0 z-5000 bg-black/60 backdrop-blur-sm transition-opacity ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      containerClassName={`fixed inset-0 z-5000 flex items-center justify-center p-4 ${open ? '' : 'pointer-events-none'}`}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl w-full h-full max-w-300 max-h-[95vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/10 shrink-0">
          <h2 className="text-body-2 text-text-primary">Book an onboarding call</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-black/5 rounded-full transition-colors cursor-pointer"
            aria-label="Close booking overlay"
          >
            <Close iconOnly />
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          <Cal
            namespace="30min"
            calLink="yosemitecrew/onboarding"
            style={{ width: '100%', height: '100%', minHeight: '600px' }}
            config={{ theme: 'light', layout: 'month_view' }}
          />
        </div>
      </div>
    </ModalBase>
  );
};

export default CalBookingOverlay;
