import React from 'react';
import { createPortal } from 'react-dom';
import Close from '@/app/ui/primitives/Icons/Close';
import { useSigningOverlayStore } from '@/app/stores/signingOverlayStore';
import { getSafeDocumensoIframeUrl } from '@/app/lib/urls';

const SigningContent = ({
  safeUrl,
  url,
  pending,
}: {
  safeUrl: string | null;
  url: string | null;
  pending: boolean;
}) => {
  if (safeUrl) {
    return (
      <iframe
        src={safeUrl}
        title="Document signing"
        className="flex-1 w-full border-0"
        allowFullScreen
        sandbox="allow-downloads allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-scripts allow-same-origin"
        referrerPolicy="strict-origin-when-cross-origin"
        style={{ pointerEvents: 'auto' }}
      />
    );
  }
  if (url) {
    return (
      <div className="flex-1 w-full flex items-center justify-center text-body-2 text-text-secondary">
        Signing session could not be loaded safely.
      </div>
    );
  }
  return (
    <div className="flex-1 w-full flex items-center justify-center text-body-2 text-text-secondary">
      {pending ? 'Preparing signing session...' : 'Loading...'}
    </div>
  );
};

const SigningOverlay = () => {
  const { open, pending, url, close } = useSigningOverlayStore();
  const safeUrl = getSafeDocumensoIframeUrl(url);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-5000 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      data-signing-overlay="true"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl w-full h-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-black/10">
          <div className="text-body-2 text-text-primary">Sign document</div>
          <button
            type="button"
            onClick={close}
            className="p-2 hover:bg-black/5 rounded-full transition-colors cursor-pointer"
            aria-label="Close signing frame"
            style={{ pointerEvents: 'auto' }}
          >
            <Close iconOnly />
          </button>
        </div>
        <SigningContent safeUrl={safeUrl} url={url} pending={pending} />
      </div>
    </div>,
    document.body
  );
};

export default SigningOverlay;
