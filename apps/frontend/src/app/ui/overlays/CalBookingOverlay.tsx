'use client';
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import CalEmbedFrame from '@/app/ui/overlays/CalEmbedFrame';
import Close from '@/app/ui/primitives/Icons/Close';

type CalBookingOverlayProps = {
  open: boolean;
  onClose: () => void;
};

const CalBookingOverlay = ({ open, onClose }: CalBookingOverlayProps) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      data-cal-booking-overlay="true"
      style={{ pointerEvents: 'auto' }}
    >
      <button
        type="button"
        onClick={onClose}
        className="fixed right-4 top-4 z-[10001] p-2 hover:bg-black/5 rounded-full transition-colors cursor-pointer bg-neutral-0/90 shadow-sm"
        aria-label="Close booking overlay"
        style={{ pointerEvents: 'auto' }}
      >
        <Close iconOnly />
      </button>
      <CalEmbedFrame
        calLink="yosemitecrew/onboarding"
        title="Book onboarding call"
        className="size-full border-0"
      />
    </div>,
    document.body
  );
};

export default CalBookingOverlay;
