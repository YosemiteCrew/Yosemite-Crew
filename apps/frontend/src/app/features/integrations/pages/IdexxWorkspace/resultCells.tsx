/**
 * The three IDEXX results-table cells, shared by the desktop table, the columns factory and the phone card.
 *
 * Split out of index.tsx because a module that exports both React components and
 * plain values loses per-component Fast Refresh: an edit here would invalidate the
 * whole workspace module instead of hot-swapping one component
 * (react-doctor/only-export-components).
 */
import React from 'react';
import Link from 'next/link';
import { IoOpenOutline } from 'react-icons/io5';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import type { LabResult } from '@/app/features/integrations/services/types';
import {
  formatTitleCase,
  getInitials,
  getResultOwnerName,
  getResultStatusTone,
  resultAwaitingReview,
} from '@/app/features/integrations/pages/IdexxWorkspace/idexxWorkspaceHelpers';

export const PatientCell = ({ result }: { result: LabResult }) => {
  const owner = getResultOwnerName(result);
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-caption-2 font-bold"
        style={{ background: 'var(--avatar-blue-bg)', color: 'var(--blue-text)' }}
        aria-hidden="true"
      >
        {getInitials(result.patientName)}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-body-4 text-text-primary">{result.patientName ?? '-'}</span>
        <span className="truncate text-caption-1 text-text-secondary">
          {owner || `ID ${result.patientId ?? '-'}`}
        </span>
      </span>
    </div>
  );
};

export const StatusCell = ({ result }: { result: LabResult }) => (
  <StatusPill
    tone={getResultStatusTone(result.status)}
    label={formatTitleCase(result.status, '-')}
  />
);

type ResultActionCellProps = {
  result: LabResult;
  appointmentLabsHref: string;
  openResultDetails: (result: LabResult) => Promise<void>;
};

export const ResultActionCell = ({
  result,
  appointmentLabsHref,
  openResultDetails,
}: ResultActionCellProps) => {
  const awaitingReview = resultAwaitingReview(result);
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {appointmentLabsHref ? (
        <Link
          href={appointmentLabsHref}
          aria-label={`Open appointment labs for result ${result.resultId}`}
          title="Open appointment labs"
          className="rounded-full p-2 transition-colors hover:bg-card-hover"
        >
          <IoOpenOutline className="text-text-primary" size={16} />
        </Link>
      ) : null}
      {awaitingReview ? (
        <Primary
          href="#"
          text="Review"
          onClick={() => openResultDetails(result).catch(() => undefined)}
          className="px-4"
        />
      ) : (
        <Secondary
          href="#"
          text="Details"
          onClick={() => openResultDetails(result).catch(() => undefined)}
          className="px-4"
        />
      )}
    </div>
  );
};
