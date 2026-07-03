'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { LuDownload } from 'react-icons/lu';
import Close from '@/app/ui/primitives/Icons/Close';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';
import { getSafePdfPreviewUrl } from '@/app/lib/urls';

type PdfPreviewOverlayProps = {
  open: boolean;
  pdfUrl: string | null;
  title: string;
  closeLabel?: string;
  downloadLabel?: string;
  onDownload?: () => void;
  onClose: () => void;
};

const PdfPreviewOverlay = ({
  open,
  pdfUrl,
  title,
  closeLabel = 'Close PDF preview',
  downloadLabel = 'Download PDF',
  onDownload,
  onClose,
}: PdfPreviewOverlayProps) => {
  const [loaded, setLoaded] = useState(false);
  const safePdfUrl = getSafePdfPreviewUrl(pdfUrl, { allowBlob: true });
  if (!open || !safePdfUrl || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[5000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      data-signing-overlay="true"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl size-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-black/10">
          <div className="text-body-2 text-text-primary">{title}</div>
          <div className="flex items-center gap-2">
            {onDownload && (
              <button
                type="button"
                onClick={onDownload}
                className="inline-flex items-center gap-2 rounded-full border border-card-border px-3 py-2 text-body-4 text-text-primary transition-colors hover:bg-black/5"
                aria-label={downloadLabel}
                style={{ pointerEvents: 'auto' }}
              >
                <LuDownload aria-hidden="true" />
                <span>Download</span>
              </button>
            )}
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
        </div>
        <div className="relative flex-1 min-h-0">
          {!loaded && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
              <YosemiteLoader label="Loading PDF" size={120} testId="pdf-preview-loader" />
            </div>
          )}
          <iframe
            key={safePdfUrl}
            src={safePdfUrl}
            title={title}
            className="size-full border-0"
            referrerPolicy="strict-origin-when-cross-origin"
            style={{ pointerEvents: 'auto' }}
            onLoad={() => setLoaded(true)}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PdfPreviewOverlay;
