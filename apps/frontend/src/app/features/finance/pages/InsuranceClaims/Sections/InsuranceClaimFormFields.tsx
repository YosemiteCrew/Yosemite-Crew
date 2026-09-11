'use client';
import React from 'react';
import { currencySymbol } from '@/app/lib/money';
import { Textarea } from '@/app/ui/Input';
import Dropdown from '@/app/ui/inputs/Dropdown/Dropdown';
import {
  fieldClass,
  inputClass,
} from '@/app/features/finance/pages/Estimates/Sections/estimateDraft';
import type { ClaimDraft } from '@/app/features/finance/pages/InsuranceClaims/Sections/useInsuranceClaimDraft';

export type CompanionChoice = { id: string; name: string };

type InsuranceClaimFormFieldsProps = {
  draft: ClaimDraft;
  setField: (patch: Partial<ClaimDraft>) => void;
  currency: string;
  companions: CompanionChoice[];
};

/**
 * The claim create form's fields. Only the fields the create endpoint accepts
 * are shown; the optional invoice and encounter links are free text because a
 * claim can be filed before either exists. Presentational - the draft state and
 * its validation live in `useInsuranceClaimDraft`.
 */
const InsuranceClaimFormFields = ({
  draft,
  setField,
  currency,
  companions,
}: InsuranceClaimFormFieldsProps) => (
  <>
    <div className="flex flex-col gap-1">
      <Dropdown
        placeholder="Companion"
        value={draft.patientId}
        onChange={(v) => setField({ patientId: v })}
        options={companions.map((companion) => ({ label: companion.name, value: companion.id }))}
        emptyLabel="Choose a companion"
      />
    </div>

    <div className="flex flex-col gap-1">
      <label htmlFor="claim-insurer" className="text-caption-2 font-bold text-text-tertiary">
        Insurer
      </label>
      <span className={fieldClass}>
        <input
          id="claim-insurer"
          type="text"
          value={draft.insurerName}
          onChange={(e) => setField({ insurerName: e.target.value })}
          className={inputClass}
        />
      </span>
    </div>

    <div className="flex flex-col gap-1">
      <label htmlFor="claim-policy" className="text-caption-2 font-bold text-text-tertiary">
        Policy number
      </label>
      <span className={fieldClass}>
        <input
          id="claim-policy"
          type="text"
          value={draft.policyNumber}
          onChange={(e) => setField({ policyNumber: e.target.value })}
          className={inputClass}
        />
      </span>
    </div>

    <div className="flex flex-col gap-1">
      <label htmlFor="claim-amount" className="text-caption-2 font-bold text-text-tertiary">
        {`Submitted amount (${currencySymbol(currency)})`}
      </label>
      <span className={`${fieldClass} max-w-52`}>
        <input
          id="claim-amount"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={draft.submittedAmount}
          onChange={(e) => setField({ submittedAmount: e.target.value })}
          className={inputClass}
        />
      </span>
    </div>

    <div className="flex flex-col gap-1">
      <label htmlFor="claim-invoice" className="text-caption-2 font-bold text-text-tertiary">
        Invoice ID (optional)
      </label>
      <span className={fieldClass}>
        <input
          id="claim-invoice"
          type="text"
          value={draft.invoiceId}
          onChange={(e) => setField({ invoiceId: e.target.value })}
          className={inputClass}
        />
      </span>
    </div>

    <div className="flex flex-col gap-1">
      <label htmlFor="claim-encounter" className="text-caption-2 font-bold text-text-tertiary">
        Encounter ID (optional)
      </label>
      <span className={fieldClass}>
        <input
          id="claim-encounter"
          type="text"
          value={draft.encounterId}
          onChange={(e) => setField({ encounterId: e.target.value })}
          className={inputClass}
        />
      </span>
    </div>

    <div className="flex flex-col gap-1">
      <label htmlFor="claim-notes" className="text-caption-2 font-bold text-text-tertiary">
        Notes (optional)
      </label>
      <span className={fieldClass}>
        <Textarea
          id="claim-notes"
          rows={2}
          value={draft.notes}
          onChange={(e) => setField({ notes: e.target.value })}
          className={inputClass}
        />
      </span>
    </div>
  </>
);

export default InsuranceClaimFormFields;
