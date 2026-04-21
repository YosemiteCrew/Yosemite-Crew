'use client';
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Cal, { getCalApi } from '@calcom/embed-react';
import Close from '@/app/ui/primitives/Icons/Close';

type CalBookingOverlayProps = {
  open: boolean;
  onClose: () => void;
};

const CalBookingOverlay = ({ open, onClose }: CalBookingOverlayProps) => {
  useEffect(() => {
    if (!open) return;
    (async () => {
      const cal = await getCalApi({ namespace: '30min' });
      cal('ui', { hideEventTypeDetails: false, layout: 'month_view' });
    })();
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <dialog
      open
      className="fixed inset-0 z-5000 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 m-0 w-full h-full max-w-none border-0"
      aria-label="Book onboarding call"
    >
      <div className="relative bg-white rounded-2xl shadow-2xl w-full h-full max-w-300 max-h-[95vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/10 shrink-0">
          <div className="text-body-2 text-text-primary">Book an onboarding call</div>
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
    </dialog>,
    document.body
  );
};

export default CalBookingOverlay;
