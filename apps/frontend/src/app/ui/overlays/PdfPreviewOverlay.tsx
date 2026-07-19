'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { IoDownloadOutline } from 'react-icons/io5';
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
  // Tracked by URL rather than as a plain boolean: keying the iframe remounts the
  // frame but leaves this state untouched, so a second PDF would skip the loader.
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const safePdfUrl = getSafePdfPreviewUrl(pdfUrl, { allowBlob: true });
  if (!open || !safePdfUrl || typeof document === 'undefined') return null;

  const loaded = loadedUrl === safePdfUrl;

  return createPortal(
    <div
      className="fixed inset-0 z-[5000] bg-[var(--sh55)] backdrop-blur-sm flex items-center justify-center p-4"
      data-signing-overlay="true"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="relative bg-neutral-0 rounded-[20px] border border-[var(--hairline)] shadow-[0_8px_20px_var(--sh10),0_36px_90px_var(--sh12)] size-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--hairline)]">
          <div className="text-body-2 text-text-primary">{title}</div>
          <div className="flex items-center gap-2">
            {onDownload && (
              <button
                type="button"
                onClick={onDownload}
                className="inline-flex items-center gap-2 rounded-full border border-card-border px-3 py-2 text-body-4 text-text-primary transition-colors hover:bg-[var(--inset)]"
                aria-label={downloadLabel}
                style={{ pointerEvents: 'auto' }}
              >
                <IoDownloadOutline aria-hidden="true" />
                <span>Download</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-[var(--inset)] rounded-full transition-colors cursor-pointer"
              aria-label={closeLabel}
              style={{ pointerEvents: 'auto' }}
            >
              <Close iconOnly />
            </button>
          </div>
        </div>
        <div className="relative flex-1 min-h-0">
          {!loaded && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-0">
              <YosemiteLoader label="Loading PDF" size={120} testId="pdf-preview-loader" />
            </div>
          )}
          {/* No `sandbox` attribute: Chrome's built-in PDF viewer refuses to
              instantiate inside a sandboxed frame, so ANY sandbox token set —
              including `allow-same-origin`, and including every token at once —
              renders a blank white frame instead of the document. The src is
              already constrained to blob:/https: by `getSafePdfPreviewUrl`, and
              `frame-src` in the CSP independently limits which origins may be
              framed at all, so the sandbox was never the control protecting
              this iframe. */}
          <iframe
            key={safePdfUrl}
            src={safePdfUrl}
            title={title}
            className="size-full border-0"
            referrerPolicy="strict-origin-when-cross-origin"
            style={{ pointerEvents: 'auto' }}
            onLoad={() => setLoadedUrl(safePdfUrl)}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PdfPreviewOverlay;
