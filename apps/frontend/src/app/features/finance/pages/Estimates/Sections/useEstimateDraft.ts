'use client';
import { useMemo, useRef, useState } from 'react';
import {
  computeEstimateTotals,
  type EstimateTotals,
} from '@/app/features/finance/pages/Estimates/Sections/estimateTotals';
import {
  emptyLine,
  toNumber,
  validateDraft,
  type DraftLine,
} from '@/app/features/finance/pages/Estimates/Sections/estimateDraft';
import type { CreateEstimateInput } from '@/app/features/finance/types/estimate';

export type EstimateDraft = {
  patientId: string;
  setPatientId: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  validUntil: string;
  setValidUntil: (value: string) => void;
  lines: DraftLine[];
  updateLine: (key: string, patch: Partial<DraftLine>) => void;
  addLine: () => void;
  removeLine: (key: string) => void;
  totals: EstimateTotals;
  formError: string | null;
  /** Validate and, if the draft is sound, hand the payload to `onSubmit`. */
  submit: (onSubmit: (input: CreateEstimateInput) => void) => void;
};

/**
 * The estimate editor's state and the payload it produces.
 *
 * Separated from the dialog so the component is composition rather than
 * composition plus a state machine, and so the draft logic can be exercised
 * without a modal around it.
 */
export const useEstimateDraft = (): EstimateDraft => {
  const [patientId, setPatientId] = useState('');
  const [notes, setNotes] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine('line-0')]);
  const [formError, setFormError] = useState<string | null>(null);

  // A counter, not state: it only ever feeds the next React key, is never
  // rendered, and as state every increment would re-render for nothing.
  const nextKey = useRef(1);

  const totals = useMemo(
    () =>
      computeEstimateTotals(
        lines.map((line) => ({
          description: line.description,
          quantity: toNumber(line.quantity),
          unitPrice: toNumber(line.unitPrice),
          taxRate: toNumber(line.taxRate),
        }))
      ),
    [lines]
  );

  const updateLine = (key: string, patch: Partial<DraftLine>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const addLine = () => {
    setLines((current) => [...current, emptyLine(`line-${nextKey.current}`)]);
    nextKey.current += 1;
  };

  const removeLine = (key: string) =>
    setLines((current) =>
      current.length === 1 ? current : current.filter((line) => line.key !== key)
    );

  /**
   * The currency is deliberately NOT sent.
   *
   * `useCurrencyForPrimaryOrg` reads `subscription.currency`, and the
   * production path builds subscriptions through `normalizeSubscription`, which
   * never populates it - so it always answers USD. Persisting that would stamp
   * USD on every estimate for a non-USD clinic, override the API's own default,
   * and then be copied onto the converted invoice. Omitting it lets the server
   * decide, which is the only side that knows. The dialog still previews in the
   * currency the rest of Finance displays; the saved estimate carries the
   * server's, and the detail view renders that.
   */
  const submit = (onSubmit: (input: CreateEstimateInput) => void) => {
    const validation = validateDraft(patientId, lines, validUntil);
    if (!validation.ok) {
      setFormError(validation.message);
      return;
    }
    setFormError(null);
    onSubmit({
      patientId,
      notes: notes.trim() || undefined,
      // The API takes an ISO datetime; a date input yields yyyy-mm-dd only.
      validUntil: validUntil ? new Date(`${validUntil}T00:00:00.000Z`).toISOString() : undefined,
      items: lines.map((line) => ({
        description: line.description.trim(),
        quantity: toNumber(line.quantity),
        unitPrice: toNumber(line.unitPrice),
        taxRate: toNumber(line.taxRate),
      })),
    });
  };

  return {
    patientId,
    setPatientId,
    notes,
    setNotes,
    validUntil,
    setValidUntil,
    lines,
    updateLine,
    addLine,
    removeLine,
    totals,
    formError,
    submit,
  };
};
