import React from 'react';
import { createPortal } from 'react-dom';
import Close from '@/app/ui/primitives/Icons/Close';
import { useSigningOverlayStore } from '@/app/stores/signingOverlayStore';
import { getSafeDocumensoIframeUrl } from '@/app/lib/urls';
import { useHasMounted } from '@/app/hooks/useHasMounted';

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
      // The third-party Documenso portal requires allow-same-origin to function, and
      // being cross-origin it cannot reach back into this site. Removing it breaks
      // signing, so this is a deliberate exception rather than a missing control.
      // react-doctor-disable-next-line react-doctor/iframe-missing-sandbox
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
  // The portal target is only available on the client; this used to read
  // document.body unguarded, which is unavailable during the server render.
  const isMounted = useHasMounted();

  if (!open || !isMounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-5000 bg-[var(--sh55)] backdrop-blur-sm flex items-center justify-center p-4"
      data-signing-overlay="true"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="relative bg-neutral-0 rounded-[20px] border border-[var(--hairline)] shadow-[0_8px_20px_var(--sh10),0_36px_90px_var(--sh12)] w-full h-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--hairline)]">
          <div className="text-body-2 text-text-primary">Sign document</div>
          <button
            type="button"
            onClick={close}
            className="p-2 hover:bg-[var(--inset)] rounded-full transition-colors cursor-pointer"
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
