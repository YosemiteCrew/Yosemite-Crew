'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useOrgStore } from '@/app/stores/orgStore';
import { fetchDocumensoRedirectUrl } from '@/app/features/documents/services/documensoService';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';
import { getSafeDocumensoIframeUrl } from '@/app/lib/urls';

type DocSigningPortalProps = {
  embedded?: boolean;
};

const DocSigningPortal = ({ embedded = false }: DocSigningPortalProps) => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  const portalUrl = useMemo(() => {
    const safeUrl = getSafeDocumensoIframeUrl(redirectUrl);
    return safeUrl || null;
  }, [redirectUrl]);

  useEffect(() => {
    if (!primaryOrgId) return;
    // A second org id can arrive while the first request is still open; the
    // cleanup marks the earlier run stale so its response cannot overwrite the
    // newer one (or land on an unmounted portal).
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      return (
        fetchDocumensoRedirectUrl(primaryOrgId)
          .then((res) => {
            if (!cancelled) setRedirectUrl(res.redirectUrl);
          })
          .catch((e: any) => {
            console.error('Failed to fetch Documenso portal URL', e);
            if (!cancelled) {
              setError(
                e?.response?.data?.message || e?.message || 'Unable to load Doc Signing portal'
              );
            }
          })
          // Settles on both paths, so a rejection cannot strand the spinner.
          .finally(() => {
            if (!cancelled) setLoading(false);
          })
      );
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [primaryOrgId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <YosemiteLoader label="Loading Doc Signing" />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="text-body-3 text-text-error">
        {error}
      </div>
    );
  }

  if (!portalUrl) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16 px-4">
        <div className="flex flex-col items-center gap-4 max-w-lg text-center">
          <h1 className="text-heading-2 text-text-primary">Document Signing Portal</h1>
          <p className="text-body-3 text-text-secondary">Portal link not available</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`w-full overflow-hidden pb-3 ${
          embedded ? 'h-[75vh] min-h-[560px]' : 'h-[calc(100vh-140px)]'
        }`}
      >
        {/* The third-party Documenso portal requires allow-same-origin to function, and
            being cross-origin it cannot reach back into this site. Removing it breaks
            signing, so this is a deliberate exception rather than a missing control. */}
        {/* react-doctor-disable-next-line react-doctor/iframe-missing-sandbox */}
        <iframe
          src={portalUrl}
          className="size-full"
          title="Doc Signing Portal"
          allow="clipboard-read; clipboard-write; fullscreen"
          sandbox="allow-downloads allow-forms allow-modals allow-popups allow-scripts allow-same-origin"
          referrerPolicy="strict-origin"
        />
      </div>
      {/* Everything above this line succeeded: a portal URL was issued and the
          frame loaded it. What happens INSIDE the frame is another origin's
          business, and this page cannot read it - so when the sign-on does not
          take, the reader is left looking at a stranger's login form with the
          app showing no error at all, because from the app's side nothing went
          wrong. That is the state this line is for. It deliberately does not
          name a cause: the frame is opaque here, and guessing at one in the UI
          would be worse than saying plainly that it did not work. */}
      <p className="text-body-4 text-text-secondary">
        Signing is handled by our document signing provider. If you see a sign-in form instead of
        your documents, it could not sign you in automatically - contact support rather than
        creating an account here.
      </p>
    </>
  );
};

export default DocSigningPortal;
