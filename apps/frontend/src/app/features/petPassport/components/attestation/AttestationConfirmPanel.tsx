'use client';

import React, { useId } from 'react';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';

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

/**
 * The app's labelled text field, so these two read exactly like the capture
 * forms in the passport step rather than as a third field geometry. `readonly`
 * is how FormInput expresses "not editable right now" - it has no `disabled`
 * prop - and it is enough here, because every action is disabled while a
 * request is in flight.
 */
const SignatoryField = ({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) => (
  <div className="min-w-0 flex-1">
    <FormInput
      intype="text"
      inlabel={label}
      value={value}
      readonly={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  </div>
);

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
          disabled={disabled}
          onChange={(signatoryName) => onSignatoryChange({ ...signatory, signatoryName })}
        />
        <SignatoryField
          label="Licence number (optional)"
          value={signatory.signatoryLicence}
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
          className="mt-0.5 size-4 shrink-0 accent-text-primary"
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
