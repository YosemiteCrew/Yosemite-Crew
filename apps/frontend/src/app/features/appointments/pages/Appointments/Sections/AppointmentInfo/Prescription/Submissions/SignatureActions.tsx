import React, { useCallback, useMemo, useState } from 'react';
import { FormSubmission } from '@yosemite-crew/types';
import {
  fetchSignedDocumentIfReady,
  startFormSigning,
} from '@/app/features/forms/services/formSigningService';
import { Primary } from '@/app/ui/primitives/Buttons';
import { useSigningOverlayStore } from '@/app/stores/signingOverlayStore';

type SubmissionWithSigning = FormSubmission & {
  signatureRequired?: boolean;
  submissionId?: string;
};

const getSigningStatusLabel = (submission: SubmissionWithSigning): string | null => {
  if (submission.signing?.status === 'SIGNED') return 'Signed';
  if (submission.signing?.status === 'IN_PROGRESS') return 'Signing in progress';
  if (submission.signing?.status) return 'Not started';
  if (submission.signatureRequired) return 'Signature required';
  return null;
};

type SignatureActionsProps = {
  submission: SubmissionWithSigning;
  onStatusChange?: (submissionId: string, updates: Partial<SubmissionWithSigning>) => void;
};

const SignatureActions = ({ submission, onStatusChange }: SignatureActionsProps) => {
  const [loading, setLoading] = useState<'sign' | 'view' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { openOverlay, setUrl, registerCloseHandler } = useSigningOverlayStore();

  const submissionId = useMemo(() => {
    const raw = submission._id || submission.submissionId;
    return raw ? String(raw) : '';
  }, [submission._id, submission.submissionId]);

  const isSigned = submission.signing?.status === 'SIGNED' || Boolean(submission.signing?.pdf?.url);
  const signingStatusLabel = getSigningStatusLabel(submission);

  const shouldShowActions = submission.signatureRequired || Boolean(submission.signing);

  const resolveSignedUrl = useCallback(async (): Promise<string | undefined> => {
    if (submission.signing?.pdf?.url) {
      return submission.signing.pdf.url;
    }
    const res = await fetchSignedDocumentIfReady(submissionId);
    const downloadUrl = res?.pdf?.downloadUrl;
    if (downloadUrl) {
      onStatusChange?.(submissionId, {
        signing: {
          ...(submission.signing ?? {
            required: true,
            provider: 'DOCUMENSO',
          }),
          status: 'SIGNED',
          pdf: { url: downloadUrl },
        },
      });
    }
    return downloadUrl;
  }, [onStatusChange, submission.signing, submissionId]);

  const handleViewSigned = async () => {
    setError(null);
    setLoading('view');
    try {
      const url = await resolveSignedUrl();
      if (url) {
        globalThis.open(url, '_blank', 'noopener,noreferrer');
      } else {
        setError('Signed document not available yet.');
      }
    } catch (err) {
      console.error('Failed to fetch signed document', err);
      setError('Unable to load signed document.');
    } finally {
      setLoading(null);
    }
  };

  const pollForSignedUrl = useCallback(
    async (attempts = 3): Promise<string | undefined> => {
      const attemptPromises = Array.from({ length: attempts }, async (_, index) => {
        if (index > 0) {
          await new Promise((resolve) => setTimeout(resolve, 750 * index));
        }
        return resolveSignedUrl();
      });
      const results = await Promise.all(attemptPromises);
      return results.find((url): url is string => Boolean(url));
    },
    [resolveSignedUrl]
  );

  const refreshSignedStatusAfterOverlayClose = useCallback(async () => {
    try {
      const url = await pollForSignedUrl();
      if (url) {
        onStatusChange?.(submissionId, {
          signing: {
            ...(submission.signing ?? { required: true, provider: 'DOCUMENSO' }),
            status: 'SIGNED',
            pdf: { url },
          },
        });
      } else if (submission.signing?.status === 'IN_PROGRESS' || submission.signatureRequired) {
        onStatusChange?.(submissionId, {
          signing: {
            ...(submission.signing ?? { required: true, provider: 'DOCUMENSO' }),
            status: 'IN_PROGRESS',
          },
        });
      }
    } catch (err) {
      console.error('Failed to refresh signed status after closing overlay', err);
    }
  }, [
    submissionId,
    onStatusChange,
    pollForSignedUrl,
    submission.signing,
    submission.signatureRequired,
  ]);

  const handleSign = async () => {
    setError(null);
    registerCloseHandler(submissionId, refreshSignedStatusAfterOverlayClose);
    openOverlay(submissionId);
    setLoading('sign');
    try {
      const res = await startFormSigning(submissionId);
      if (res?.documentId) {
        onStatusChange?.(submissionId, {
          signing: {
            required: true,
            provider: 'DOCUMENSO',
            status: 'IN_PROGRESS',
            documentId: String(res.documentId),
            signer: submission.signing?.signer,
            pdf: submission.signing?.pdf,
          },
        });
      }
      if (res?.signingUrl) {
        setUrl(res.signingUrl);
      } else {
        setError('Signing link not available. Please retry.');
      }
    } catch (err) {
      console.error('Failed to start signing', err);
      setError('Unable to start signing. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  if (!submissionId || !shouldShowActions) return null;

  return (
    <div className="flex flex-col gap-2">
      {signingStatusLabel ? (
        <div
          className={`text-xs ${isSigned ? 'text-[var(--success-text)]' : 'text-text-secondary'}`}
        >
          {signingStatusLabel}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {isSigned ? null : (
          <Primary
            href="#"
            text={loading === 'sign' ? '...' : 'Sign'}
            onClick={handleSign}
            isDisabled={loading === 'sign'}
            size="default"
          />
        )}

        {isSigned ? (
          <Primary
            href="#"
            text={loading === 'view' ? '...' : 'View'}
            onClick={handleViewSigned}
            isDisabled={loading === 'view'}
            size="default"
          />
        ) : null}
      </div>
      {error ? <div className="text-xs text-text-error">{error}</div> : null}
    </div>
  );
};

export default SignatureActions;
