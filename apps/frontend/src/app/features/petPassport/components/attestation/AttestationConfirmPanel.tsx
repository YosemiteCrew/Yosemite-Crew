'use client';

import React, { useId } from 'react';
import { Input } from '@/app/ui';

export type SignatoryDetails = {
  signatoryName: string;
  signatoryLicence: string;
};

type AttestationConfirmPanelProps = {
  confirmed: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
  signatory: SignatoryDetails;
  onSignatoryChange: (signatory: SignatoryDetails) => void;
  disabled: boolean;
};

const LABEL_CLASS = 'text-[12px] font-semibold text-[var(--ink-soft)]';

const SignatoryField = ({
  label,
  value,
  placeholder,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) => {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <Input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        className="min-h-10! px-3.5! text-[12.5px]!"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
};

/**
 * The legal half of the panel. Attesting a clinical record is a veterinary act
 * a border officer relies on (EU 576/2013 for the EU pet passport, the UK's
 * animal health certificate signed by an official veterinarian, and USDA APHIS
 * endorsement), so the statement is spelled out and the actions stay inert
 * until the vet ticks it - no single stray click can sign a record.
 */
const AttestationConfirmPanel = ({
  confirmed,
  onConfirmedChange,
  signatory,
  onSignatoryChange,
  disabled,
}: AttestationConfirmPanelProps) => {
  const checkboxId = useId();

  return (
    <section
      aria-label="Attestation declaration"
      className="flex flex-col gap-3 rounded-[14px] border border-[var(--divider)] bg-[var(--inset)] p-3.5"
    >
      <p className="text-[12px] leading-relaxed text-[var(--ink-body)]">
        Attesting makes this record part of the pet passport. Border and import authorities read it
        as a veterinary declaration under EU 576/2013, a UK animal health certificate, or a USDA
        APHIS endorsement, so only attest what you have read and can stand behind.
      </p>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <SignatoryField
          label="Signing veterinarian (optional)"
          value={signatory.signatoryName}
          placeholder="Name as it should appear"
          disabled={disabled}
          onChange={(signatoryName) => onSignatoryChange({ ...signatory, signatoryName })}
        />
        <SignatoryField
          label="Licence number (optional)"
          value={signatory.signatoryLicence}
          placeholder="Veterinary licence"
          disabled={disabled}
          onChange={(signatoryLicence) => onSignatoryChange({ ...signatory, signatoryLicence })}
        />
      </div>
      <div className="flex items-start gap-2.5">
        <input
          id={checkboxId}
          type="checkbox"
          checked={confirmed}
          disabled={disabled}
          className="mt-0.5 size-4 shrink-0 accent-[var(--cta)]"
          onChange={(event) => onConfirmedChange(event.target.checked)}
        />
        <label htmlFor={checkboxId} className="text-[12px] leading-relaxed text-[var(--ink-body)]">
          I have read the uploaded document, the record above matches it, and I am attesting to it
          as the responsible veterinarian.
        </label>
      </div>
    </section>
  );
};

export default AttestationConfirmPanel;
