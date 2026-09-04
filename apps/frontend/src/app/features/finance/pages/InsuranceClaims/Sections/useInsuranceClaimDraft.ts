'use client';
import { useState } from 'react';
import type { CreateInsuranceClaimInput } from '@/app/features/finance/types/insuranceClaim';

/**
 * The claim editor's draft state, validation and payload building. Kept out of
 * the dialog component so the dialog reads as composition, so Fast Refresh can
 * preserve the form's state (a component file that also exports non-components
 * forces a full reload), and so the validation can be tested without rendering.
 */
export type ClaimDraft = {
  patientId: string;
  insurerName: string;
  policyNumber: string;
  submittedAmount: string;
  invoiceId: string;
  encounterId: string;
  notes: string;
};

const emptyDraft: ClaimDraft = {
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
export const validateClaimDraft = (draft: ClaimDraft): Validation => {
  if (!draft.patientId) return { ok: false, message: 'Choose a companion for this claim.' };
  if (!draft.insurerName.trim()) return { ok: false, message: "Enter the insurer's name." };
  if (!draft.policyNumber.trim()) return { ok: false, message: 'Enter the policy number.' };
  const amount = Number(draft.submittedAmount.trim());
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: 'The submitted amount must be above zero.' };
  }
  return { ok: true };
};

/** Build the create payload, trimming strings and omitting the empty optionals. */
export const buildClaimInput = (
  draft: ClaimDraft,
  currency: string
): CreateInsuranceClaimInput => ({
  patientId: draft.patientId,
  insurerName: draft.insurerName.trim(),
  policyNumber: draft.policyNumber.trim(),
  submittedAmount: Number(draft.submittedAmount.trim()),
  currency,
  ...(draft.invoiceId.trim() ? { invoiceId: draft.invoiceId.trim() } : {}),
  ...(draft.encounterId.trim() ? { encounterId: draft.encounterId.trim() } : {}),
  ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
});

export type UseInsuranceClaimDraft = {
  draft: ClaimDraft;
  setField: (patch: Partial<ClaimDraft>) => void;
  formError: string | null;
  /** Validate, then either surface the message or hand the built payload up. */
  submit: (currency: string, onSubmit: (input: CreateInsuranceClaimInput) => void) => void;
};

export const useInsuranceClaimDraft = (): UseInsuranceClaimDraft => {
  const [draft, setDraft] = useState<ClaimDraft>(emptyDraft);
  const [formError, setFormError] = useState<string | null>(null);

  const setField = (patch: Partial<ClaimDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const submit = (currency: string, onSubmit: (input: CreateInsuranceClaimInput) => void) => {
    const result = validateClaimDraft(draft);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    setFormError(null);
    onSubmit(buildClaimInput(draft, currency));
  };

  return { draft, setField, formError, submit };
};
