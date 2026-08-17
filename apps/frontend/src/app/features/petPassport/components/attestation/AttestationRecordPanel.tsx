'use client';

import React from 'react';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import type { CompanionRecord } from '@/app/features/documents/types/companionDocuments';
import {
  PASSPORT_RECORD_STATUS_META,
  PassportRecordStatus,
  getReviewFields,
} from '@/app/features/petPassport/components/attestation/attestationModel';

type AttestationRecordPanelProps = {
  record: CompanionRecord;
  status: PassportRecordStatus;
};

/** The parsed record beside the file: what the attestation actually says. */
const AttestationRecordPanel = ({ record, status }: AttestationRecordPanelProps) => {
  const meta = PASSPORT_RECORD_STATUS_META[status];
  const fields = getReviewFields(record);

  return (
    <section
      aria-label="Passport record"
      className="flex flex-col gap-3 rounded-[14px] border border-[var(--hairline)] bg-[var(--screen)] p-3.5"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--ink-faint)]">
          Record for the passport
        </h3>
        <StatusPill label={meta.label} tone={meta.tone} />
      </div>
      <p className="text-[12px] leading-relaxed text-[var(--ink-body)]">{meta.detail}</p>
      <dl className="flex flex-col gap-2">
        {fields.map((field) => (
          <div key={field.label} className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-2">
            <dt className="text-[12px] text-[var(--ink-faint)]">{field.label}</dt>
            <dd className="text-[12px] font-bold break-words text-[var(--ink)]">{field.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

export default AttestationRecordPanel;
