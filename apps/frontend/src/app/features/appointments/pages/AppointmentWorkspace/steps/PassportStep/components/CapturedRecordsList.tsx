'use client';
import React from 'react';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import StatusPill, { type StatusTone } from '@/app/ui/primitives/StatusPill/StatusPill';
import {
  PASSPORT_RECORD_KIND_LABELS,
  type PassportRecordRow,
  type PassportRecordStatus,
} from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/passportRecordRows';

const STATUS_PILLS: Record<PassportRecordStatus, { label: string; tone: StatusTone }> = {
  DRAFT: { label: 'Draft', tone: 'accent' },
  SIGNED: { label: 'Signed', tone: 'success' },
};

const RecordRow = ({ row }: { row: PassportRecordRow }) => {
  const pill = STATUS_PILLS[row.status];
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-(--divider) py-3 last:border-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-(--ink-faint)">
          {PASSPORT_RECORD_KIND_LABELS[row.kind]}
        </span>
        <span className="text-[13.5px] font-semibold text-(--ink-body)">{row.title}</span>
        <span className="text-[12px] text-(--ink-muted)">{row.detail}</span>
      </div>
      <StatusPill label={pill.label} tone={pill.tone} />
    </li>
  );
};

const RecordsBody = ({ rows, isLoading }: { rows: PassportRecordRow[]; isLoading: boolean }) => {
  if (isLoading) {
    return <p className="text-[12.5px] text-(--ink-muted)">Loading passport records...</p>;
  }
  if (rows.length === 0) {
    return (
      <p className="text-[12.5px] text-(--ink-muted)">
        No passport records for this companion yet.
      </p>
    );
  }
  return (
    <ul className="flex flex-col">
      {rows.map((row) => (
        <RecordRow key={`${row.kind}-${row.id}`} row={row} />
      ))}
    </ul>
  );
};

type CapturedRecordsListProps = {
  rows: PassportRecordRow[];
  isLoading: boolean;
  loadError: string | null;
};

/**
 * Passport records with their attestation state. A record captured here is a
 * DRAFT: it belongs to the visit but stays off the passport until a vet signs
 * it, which is why the state is shown next to every row rather than implied.
 */
const CapturedRecordsList = ({ rows, isLoading, loadError }: CapturedRecordsListProps) => (
  <SectionContainer title="Passport records">
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] leading-[140%] text-(--ink-muted)">
        Only signed records count towards the passport. A draft is saved against this visit and
        joins the passport once a veterinarian signs it.
      </p>
      {loadError && (
        <p role="alert" className="text-caption-1 text-danger-600">
          {loadError}
        </p>
      )}
      <RecordsBody rows={rows} isLoading={isLoading} />
    </div>
  </SectionContainer>
);

export default CapturedRecordsList;
