import React, { useMemo, useState } from "react";
import { FormSubmission } from "@yosemite-crew/types";
import {
  downloadSubmissionPdf,
  fetchSignedDocument,
  startFormSigning,
} from "@/app/services/formSigningService";
import { Primary, Secondary } from "@/app/components/Buttons";
import Close from "@/app/components/Icons/Close";
import { useSigningOverlayStore } from "@/app/stores/signingOverlayStore";
import { useEffect, useRef } from "react";

type SubmissionWithSigning = FormSubmission & {
  signatureRequired?: boolean;
  submissionId?: string;
};

type SignatureActionsProps = {
  submission: SubmissionWithSigning;
  onStatusChange?: (
    submissionId: string,
    updates: Partial<SubmissionWithSigning>,
  ) => void;
};

const SignatureActions = ({
  submission,
  onStatusChange,
}: SignatureActionsProps) => {
  const [loading, setLoading] = useState<"sign" | "view" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    openOverlay,
    setUrl,
    open: overlayOpen,
    submissionId: overlaySubmissionId,
  } = useSigningOverlayStore();
  const wasOverlayOpen = useRef(false);
  const lastOverlaySubmissionId = useRef<string | null>(null);

  const submissionId = useMemo(
    () => {
      const raw = submission._id || submission.submissionId;
      return raw ? String(raw) : "";
    },
    [submission._id, submission.submissionId],
  );

  const isSigned =
    submission.signing?.status === "SIGNED" ||
    Boolean(submission.signing?.pdf?.url);

  const shouldShowActions =
    submission.signatureRequired || Boolean(submission.signing);

  if (!submissionId || !shouldShowActions) return null;

  const handleSign = async () => {
    setError(null);
    openOverlay(submissionId);
    setLoading("sign");
    try {
      const res = await startFormSigning(submissionId);
      if (res?.documentId) {
        onStatusChange?.(submissionId, {
          signing: {
            required: true,
            provider: "DOCUMENSO",
            status: "IN_PROGRESS",
            documentId: String(res.documentId),
            signer: submission.signing?.signer,
            pdf: submission.signing?.pdf,
          },
        });
      }
      if (res?.signingUrl) {
        setUrl(res.signingUrl);
      } else {
        setError("Signing link not available. Please retry.");
      }
    } catch (err) {
      console.error("Failed to start signing", err);
      setError("Unable to start signing. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const resolveSignedUrl = async (): Promise<string | undefined> => {
    if (submission.signing?.pdf?.url) {
      return submission.signing.pdf.url;
    }
    const res = await fetchSignedDocument(submissionId);
    const downloadUrl = res?.pdf?.downloadUrl;
    if (downloadUrl) {
      onStatusChange?.(submissionId, {
        signing: {
          ...(submission.signing ?? {
            required: true,
            provider: "DOCUMENSO",
          }),
          status: "SIGNED",
          pdf: { url: downloadUrl },
        },
      });
    }
    return downloadUrl;
  };


  const handleViewSigned = async () => {
    setError(null);
    setLoading("view");
    try {
      const url = await resolveSignedUrl();
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        setError("Signed document not available yet.");
      }
    } catch (err) {
      console.error("Failed to fetch signed document", err);
      setError("Unable to load signed document.");
    } finally {
      setLoading(null);
    }
  };

  const handleDownloadPdf = async () => {
    setError(null);
    setLoading("pdf");
    try {
      const blob = await downloadSubmissionPdf(submissionId);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `form-submission-${submissionId}.pdf`;
      link.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Failed to download PDF", err);
      setError("Unable to download PDF right now.");
    } finally {
      setLoading(null);
    }
  };

  const pollForSignedUrl = async (attempts = 3): Promise<string | undefined> => {
    for (let i = 0; i < attempts; i += 1) {
      const url = await resolveSignedUrl();
      if (url) return url;
      // small delay before next retry
      await new Promise((r) => setTimeout(r, 750 * (i + 1)));
    }
    return undefined;
  };

  useEffect(() => {
    if (overlayOpen && overlaySubmissionId) {
      lastOverlaySubmissionId.current = overlaySubmissionId;
    }

    // When the signing overlay closes for this submission, refresh signed status once.
    if (
      wasOverlayOpen.current &&
      !overlayOpen &&
      lastOverlaySubmissionId.current === submissionId
    ) {
      void (async () => {
        try {
          const url = await pollForSignedUrl();
          if (!url && submission.signing?.status === "IN_PROGRESS") {
            onStatusChange?.(submissionId, {
              signing: {
                ...(submission.signing ?? { required: true, provider: "DOCUMENSO" }),
                status: "IN_PROGRESS",
              },
            });
          }
        } catch (err) {
          console.error("Failed to refresh signed status after closing overlay", err);
        }
      })();
    }
    wasOverlayOpen.current = overlayOpen;
  }, [
    overlayOpen,
    overlaySubmissionId,
    submissionId,
    onStatusChange,
    resolveSignedUrl,
    submission.signing,
  ]);

  return (
    <div className="flex flex-col gap-2 mt-3">
      <div className="flex flex-wrap gap-2">
        {!isSigned ? (
          <Primary
            href="#"
            text={loading === "sign" ? "Starting..." : "Sign document"}
            onClick={handleSign}
            isDisabled={loading === "sign"}
            size="default"
          />
        ) : null}

        <Secondary
          href="#"
          text={loading === "pdf" ? "Preparing…" : "Download PDF"}
          onClick={handleDownloadPdf}
          isDisabled={loading === "pdf"}
          size="default"
        />

        {isSigned ? (
          <Primary
            href="#"
            text={loading === "view" ? "Loading…" : "View signed doc"}
            onClick={handleViewSigned}
            isDisabled={loading === "view"}
            size="default"
          />
        ) : null}
      </div>
      {error ? <div className="text-xs text-error-main">{error}</div> : null}
    </div>
  );
};

export default SignatureActions;
