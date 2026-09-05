/**
 * The summary step's "All Documents" table and its two status pills.
 *
 * Split out of SummaryStep.tsx because a module that exports both React components
 * and plain values loses per-component Fast Refresh: an edit here would invalidate
 * the whole step module instead of hot-swapping one component
 * (react-doctor/only-export-components).
 */
import React, { useState } from 'react';
import type { WorkspaceDocumentRow } from '@yosemite-crew/types';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import StatusPill, { type StatusTone } from '@/app/ui/primitives/StatusPill/StatusPill';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import PdfPreviewOverlay from '@/app/ui/overlays/PdfPreviewOverlay';
import { IoDownloadOutline, IoEyeOutline } from 'react-icons/io5';
import { getRenderedDocument } from '@/app/features/appointments/services/workspaceClinicalService';
import {
  downloadDocumentUrl,
  formatDateTime,
  humanizeToken,
} from '@/app/features/appointments/pages/AppointmentWorkspace/steps/summaryStepFormat';

/** The documents read-model types timestamps as `Date` in the contract but they
 *  arrive as JSON strings over the wire — normalise to ISO for formatting. */
const toIsoString = (value: string | Date): string =>
  typeof value === 'string' ? value : new Date(value).toISOString();

export const DocumentSourcePill = ({ source }: { source: string }) => (
  <span className="inline-flex rounded-2xl border border-neutral-300 bg-neutral-100 px-3 py-1 text-caption-1 text-text-primary">
    {humanizeToken(source)}
  </span>
);

const signingStatusTone = (signingStatus?: string | null): StatusTone => {
  const key = String(signingStatus ?? '')
    .trim()
    .toUpperCase();
  if (key === 'SIGNED' || key === 'PAID') return 'success';
  if (key === 'ATTACHED') return 'info';
  if (key === 'IN_PROGRESS') return 'progress';
  return 'neutral';
};

const SigningStatusPill = ({ signingStatus }: { signingStatus?: string | null }) => {
  return (
    <StatusPill
      tone={signingStatusTone(signingStatus)}
      label={humanizeToken(signingStatus)}
      className="w-fit"
    />
  );
};

export const AllDocumentsTable = ({
  documents,
  organisationId,
  canView,
  error,
}: {
  documents: WorkspaceDocumentRow[];
  organisationId?: string;
  canView: boolean;
  error?: string | null;
}) => {
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ title: string; url: string } | null>(null);

  const resolveDocumentUrl = async (document: WorkspaceDocumentRow) => {
    if (document.pdfUrl) return document.pdfUrl;
    if (!organisationId) throw new Error('Organisation missing for document lookup.');
    const rendered = await getRenderedDocument(organisationId, document.documentId);
    const pdfUrl = (rendered as { pdfUrl?: unknown }).pdfUrl;
    if (typeof pdfUrl === 'string' && pdfUrl.trim()) return pdfUrl.trim();
    throw new Error('Document PDF is not available yet.');
  };

  const handleDocumentAction = async (document: WorkspaceDocumentRow) => {
    setDocumentError(null);
    try {
      const url = await resolveDocumentUrl(document);
      setPreview({ title: document.title, url });
    } catch (actionError) {
      console.error('Unable to open workspace document:', actionError);
      setDocumentError(
        actionError instanceof Error ? actionError.message : 'Unable to open document.'
      );
    }
  };

  return (
    <SectionContainer title="All Documents" className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-2xl bg-danger-100 p-4 text-body-4 text-text-error">
          {error}
        </p>
      )}
      {!error && documents.length === 0 && (
        <p className="rounded-2xl bg-neutral-100 p-4 text-body-4 text-text-secondary">
          No documents recorded yet.
        </p>
      )}
      {!error && documents.length > 0 && (
        <div className="flex flex-col gap-3">
          {/* Stacked cards, not a fixed multi-column grid: the section lives in a ~400px aside, so a
              6-track row forces the status/signing pills to overflow their columns and overlap the
              neighbouring cell. A card keeps the title on its own line (truncates with a tooltip),
              lets the pills wrap, and pins the actions to the right at every width. */}
          <ul className="flex flex-col gap-3">
            {documents.map((document) => (
              <li
                key={document.documentId}
                className="flex items-start gap-3 rounded-2xl border border-card-border p-4"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="truncate font-medium text-text-primary" title={document.title}>
                    {document.title}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <DocumentSourcePill source={document.sourceKind} />
                    <span className="text-body-4 text-text-primary">
                      {humanizeToken(document.status)}
                    </span>
                    <SigningStatusPill signingStatus={document.signingStatus} />
                  </div>
                  <span className="text-body-4 text-text-secondary">
                    {formatDateTime(toIsoString(document.createdAt))}
                  </span>
                </div>
                {canView && (
                  <div className="flex shrink-0 justify-end gap-2">
                    <CircleIconButton
                      icon={<IoEyeOutline aria-hidden="true" />}
                      label={`View ${document.title}`}
                      variant="dark"
                      onClick={() => void handleDocumentAction(document)}
                    />
                    <CircleIconButton
                      icon={<IoDownloadOutline aria-hidden="true" />}
                      label={`Download ${document.title}`}
                      onClick={() => void handleDocumentAction(document)}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
          {documentError && (
            <p role="alert" className="rounded-2xl bg-danger-100 p-3 text-body-4 text-text-error">
              {documentError}
            </p>
          )}
        </div>
      )}
      <PdfPreviewOverlay
        open={Boolean(preview)}
        title={preview?.title ?? 'Document'}
        pdfUrl={preview?.url ?? null}
        downloadLabel={`Download ${preview?.title ?? 'document'}`}
        onDownload={preview ? () => downloadDocumentUrl(preview.url) : undefined}
        onClose={() => setPreview(null)}
      />
    </SectionContainer>
  );
};
