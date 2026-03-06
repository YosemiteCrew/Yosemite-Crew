import React from 'react';
import { createPortal } from 'react-dom';
import Close from '@/app/ui/primitives/Icons/Close';

type PdfPreviewOverlayProps = {
  open: boolean;
  pdfUrl: string | null;
  title: string;
  closeLabel?: string;
  onClose: () => void;
};

const PdfPreviewOverlay = ({ open, pdfUrl, title, closeLabel = 'Close PDF preview', onClose }: PdfPreviewOverlayProps) => {
  if (!open || !pdfUrl || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[5000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      data-signing-overlay="true"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl w-full h-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-black/10">
          <div className="text-body-2 text-text-primary">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-black/5 rounded-full transition-colors cursor-pointer"
            aria-label={closeLabel}
            style={{ pointerEvents: 'auto' }}
          >
            <Close iconOnly />
          </button>
        </div>
        <iframe src={pdfUrl} title={title} className="flex-1 w-full border-0" style={{ pointerEvents: 'auto' }} />
      </div>
    </div>,
    document.body
  );
};

export default PdfPreviewOverlay;
