'use client';
import React from 'react';
import type { LabBreedSubstitution } from '@/app/features/integrations/services/types';

type BreedSubstitutionNoticeProps = {
  substitution: LabBreedSubstitution | null | undefined;
};

/**
 * What each reason means for the clinician reading the order back.
 *
 * `MISMATCHED_BREED` is deliberately separated: the other two are mapping gaps
 * in the provider's vocabulary and nothing is wrong with the record, whereas a
 * mismatch means the companion's stored breed code disagrees with its species -
 * a defect on the patient record that someone should correct.
 */
const REASON_TEXT: Record<LabBreedSubstitution['reason'], string> = {
  UNMAPPED_BREED: 'the lab has no code for this breed',
  UNCODED_BREED: 'no breed code is recorded for this companion',
  MISMATCHED_BREED: "the companion's breed code does not match its species",
};

/**
 * Says which breed was requested and which code actually reached the lab.
 *
 * Without this the substitution is invisible: the order reads back showing the
 * breed the clinician chose, while the requisition that reached the provider
 * named something else. It is recorded on the order either way - the gap was
 * only ever that nothing displayed it.
 */
const BreedSubstitutionNotice = ({ substitution }: BreedSubstitutionNoticeProps) => {
  if (!substitution) return null;

  const { requestedBreedCode, usedBreedCode, reason } = substitution;
  const defect = reason === 'MISMATCHED_BREED';

  return (
    <div
      role="note"
      aria-label="Breed substitution"
      className={`flex flex-col gap-1 rounded-2xl border px-4 py-3 ${
        defect ? 'border-danger-200 bg-danger-100' : 'border-warning-200 bg-warning-100'
      }`}
    >
      <span
        className={`text-caption-1 font-bold ${defect ? 'text-text-error' : 'text-text-primary'}`}
      >
        {defect ? 'Breed code does not match the species' : 'A different breed code was sent'}
      </span>
      <span className="text-caption-1 text-text-secondary">
        {`Sent as ${usedBreedCode} because ${REASON_TEXT[reason]}`}
        {requestedBreedCode ? ` (recorded breed: ${requestedBreedCode})` : ''}.
      </span>
      {defect ? (
        <span className="text-caption-1 text-text-secondary">
          Correct the breed on the companion record so future orders carry it.
        </span>
      ) : null}
    </div>
  );
};

export default BreedSubstitutionNotice;
