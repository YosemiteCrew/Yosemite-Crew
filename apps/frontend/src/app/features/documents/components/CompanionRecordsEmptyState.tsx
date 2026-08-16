import React from 'react';
import { IoFolderOpenOutline } from 'react-icons/io5';

type CompanionRecordsEmptyStateProps = {
  /** Optional edit-gated call to action rendered under the copy. */
  action?: React.ReactNode;
};

/**
 * The companion medical record empty state, per the "Records & Reference"
 * design: a 64px blue-soft icon chip, a Newsreader headline, a muted supporting
 * line, and an optional upload call to action.
 */
const CompanionRecordsEmptyState = ({ action }: CompanionRecordsEmptyStateProps) => (
  <div className="flex w-full flex-col items-center justify-center gap-3.5 px-6 py-12 text-center">
    <span
      aria-hidden="true"
      className="flex size-16 items-center justify-center rounded-full bg-[var(--blue-soft)] text-[var(--blue-text)]"
    >
      <IoFolderOpenOutline size={27} />
    </span>
    <span className="font-newsreader text-[23px] leading-tight text-[var(--ink)]">
      No records yet
    </span>
    <span className="max-w-[380px] text-[13px] leading-[1.6] text-[var(--ink-muted)]">
      Everything from visits lands here automatically: SOAP notes, labs, prescriptions, invoices.
      You can also upload history from a previous clinic.
    </span>
    {action ? (
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2.5">{action}</div>
    ) : null}
  </div>
);

export default CompanionRecordsEmptyState;
