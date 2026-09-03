'use client';
import React, { useState } from 'react';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { currencySymbol } from '@/app/lib/money';
import {
  fieldClass,
  inputClass,
} from '@/app/features/finance/pages/Estimates/Sections/estimateDraft';
import type { CreateInsuranceClaimInput } from '@/app/features/finance/types/insuranceClaim';

export type CompanionChoice = { id: string; name: string };

type CreateInsuranceClaimDialogProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  companions: CompanionChoice[];
  currency: string;
  saving: boolean;
  error: string | null;
  onSubmit: (input: CreateInsuranceClaimInput) => void;
};

type Draft = {
  patientId: string;
  insurerName: string;
  policyNumber: string;
  submittedAmount: string;
  invoiceId: string;
  encounterId: string;
  notes: string;
};

const emptyDraft: Draft = {
  patientId: '',
  insurerName: '',
  policyNumber: '',
  submittedAmount: '',
  invoiceId: '',
  encounterId: '',
  notes: '',
};

type Validation = { ok: true } | { ok: false; message: string };

/**
 * Validate the draft the way the controller's `CreateBodySchema` does, so the
 * user learns what is wrong before a request goes out rather than reading a zod
 * error afterwards: patient, insurer and policy are required, and the amount
 * must be positive.
 */
const validateDraft = (draft: Draft): Validation => {
  if (!draft.patientId) return { ok: false, message: 'Choose a companion for this claim.' };
  if (!draft.insurerName.trim()) return { ok: false, message: "Enter the insurer's name." };
  if (!draft.policyNumber.trim()) return { ok: false, message: 'Enter the policy number.' };
  const amount = Number(draft.submittedAmount.trim());
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: 'The submitted amount must be above zero.' };
  }
  return { ok: true };
};

/**
 * The insurance-claim editor. A claim always starts as a DRAFT, so there is no
 * status control here - the claim is submitted and progressed from its detail
 * panel. Only the fields the create endpoint accepts are shown; the optional
 * invoice and encounter links are free text because a claim can be filed before
 * either exists.
 */
const CreateInsuranceClaimDialog = ({
  open,
  setOpen,
  companions,
  currency,
  saving,
  error,
  onSubmit,
}: CreateInsuranceClaimDialogProps) => {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [formError, setFormError] = useState<string | null>(null);
  const message = formError ?? error;

  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  // A create request cannot be cancelled, so every dismissal route is closed
  // while saving - ModalBase also closes on Escape and an outside click, and
  // neither consults the disabled Cancel button.
  const setOpenUnlessSaving: React.Dispatch<React.SetStateAction<boolean>> = (value) => {
    if (saving) return;
    setOpen(value);
  };

  const submit = () => {
    const result = validateDraft(draft);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    setFormError(null);
    onSubmit({
      patientId: draft.patientId,
      insurerName: draft.insurerName.trim(),
      policyNumber: draft.policyNumber.trim(),
      submittedAmount: Number(draft.submittedAmount.trim()),
      currency,
      ...(draft.invoiceId.trim() ? { invoiceId: draft.invoiceId.trim() } : {}),
      ...(draft.encounterId.trim() ? { encounterId: draft.encounterId.trim() } : {}),
      ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
    });
  };

  return (
    <CenterModal
      showModal={open}
      setShowModal={setOpenUnlessSaving}
      ariaLabel="Create an insurance claim"
      containerClassName="sm:w-[min(640px,92vw)]! max-h-[90vh] overflow-y-auto"
    >
      <div className="flex flex-col gap-4 p-6!">
        <h2 className="text-heading-4 text-text-primary">New insurance claim</h2>

        <div className="flex flex-col gap-1">
          <label htmlFor="claim-companion" className="text-caption-2 font-bold text-text-tertiary">
            Companion
          </label>
          <span className={fieldClass}>
            <select
              id="claim-companion"
              value={draft.patientId}
              onChange={(e) => set({ patientId: e.target.value })}
              className={inputClass}
            >
              <option value="">Choose a companion</option>
              {companions.map((companion) => (
                <option key={companion.id} value={companion.id}>
                  {companion.name}
                </option>
              ))}
            </select>
          </span>
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
              onChange={(e) => set({ insurerName: e.target.value })}
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
              onChange={(e) => set({ policyNumber: e.target.value })}
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
              onChange={(e) => set({ submittedAmount: e.target.value })}
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
              onChange={(e) => set({ invoiceId: e.target.value })}
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
              onChange={(e) => set({ encounterId: e.target.value })}
              className={inputClass}
            />
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="claim-notes" className="text-caption-2 font-bold text-text-tertiary">
            Notes (optional)
          </label>
          <span className={fieldClass}>
            <textarea
              id="claim-notes"
              rows={2}
              value={draft.notes}
              onChange={(e) => set({ notes: e.target.value })}
              className={inputClass}
            />
          </span>
        </div>

        {message ? (
          <p role="alert" className="text-body-4 text-text-error">
            {message}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <Secondary
            text="Cancel"
            isDisabled={saving}
            onClick={() => setOpenUnlessSaving(false)}
            ariaLabel="Cancel creating this claim"
          />
          <Primary
            text={saving ? 'Creating...' : 'Create claim'}
            isDisabled={saving}
            onClick={submit}
            ariaLabel="Create this insurance claim"
          />
        </div>
      </div>
    </CenterModal>
  );
};

export default CreateInsuranceClaimDialog;
