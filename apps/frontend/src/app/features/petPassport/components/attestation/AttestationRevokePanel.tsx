'use client';

import React, { useId } from 'react';

type AttestationRevokePanelProps = {
  reason: string;
  onReasonChange: (reason: string) => void;
  disabled: boolean;
};

/**
 * The second step of a revocation. Revoking pulls a record a border officer may
 * already have relied on back out of the passport, so it gets its own screen and
 * its own confirm rather than sitting one click away in the review footer.
 */
const AttestationRevokePanel = ({
  reason,
  onReasonChange,
  disabled,
}: AttestationRevokePanelProps) => {
  const reasonId = useId();

  return (
    <section
      aria-label="Revoke attestation"
      className="flex flex-col gap-3 rounded-[14px] border border-[var(--danger-border)] bg-[var(--danger-bg)] p-3.5"
    >
      <p className="text-[12px] leading-relaxed text-[var(--ink-body)]">
        Revoking removes this record from the pet passport. Anyone who has already scanned the
        passport will no longer see it, and the record cannot be attested again from here.
      </p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={reasonId} className="text-[12.5px] font-semibold text-[var(--ink-soft)]">
          Reason (optional, stored with the record)
        </label>
        <textarea
          id={reasonId}
          value={reason}
          disabled={disabled}
          rows={3}
          placeholder="For example: issued in error, or the certificate was superseded."
          className="min-h-18 w-full rounded-[12px] border-[1.5px] border-[var(--hairline)] bg-[var(--field-bg)] px-3.5 py-3 text-[12.5px] leading-[1.5] text-[var(--ink-body)] outline-none transition-colors placeholder:text-[var(--ink-faint)] focus:border-[var(--blue)] focus:shadow-[0_0_0_3px_var(--glow-b10)] disabled:cursor-not-allowed disabled:opacity-60"
          onChange={(event) => onReasonChange(event.target.value)}
        />
      </div>
    </section>
  );
};

export default AttestationRevokePanel;
