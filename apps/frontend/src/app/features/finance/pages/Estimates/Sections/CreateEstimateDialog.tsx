'use client';
import React, { useMemo, useState } from 'react';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { formatMoneyPrecise } from '@/app/lib/money';
import {
  computeEstimateTotals,
  computeLineTotal,
} from '@/app/features/finance/pages/Estimates/Sections/estimateTotals';
import type { CreateEstimateInput } from '@/app/features/finance/types/estimate';

export type CompanionChoice = { id: string; name: string };

type CreateEstimateDialogProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  companions: CompanionChoice[];
  currency: string;
  saving: boolean;
  error: string | null;
  onSubmit: (input: CreateEstimateInput) => void;
};

type DraftLine = {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
};

const emptyLine = (key: string): DraftLine => ({
  key,
  description: '',
  quantity: '1',
  unitPrice: '',
  taxRate: '0',
});

/** A blank or unparseable numeric field reads as 0 rather than NaN. */
const toNumber = (raw: string): number => {
  const parsed = Number(raw.trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const inputClass =
  'min-w-0 flex-1 bg-transparent px-3 py-2 text-body-4 text-text-primary outline-none';
const fieldClass =
  'flex items-stretch overflow-hidden rounded-2xl border border-input-border-default focus-within:border-input-border-active';

/**
 * Validate a draft the way the backend's zod schema does, so the user is told
 * what is wrong before a request is sent rather than reading a flattened zod
 * error afterwards. `items.min(1)`, `description.min(1)`, `quantity.positive()`
 * and `unitPrice.min(0)` all come from CreateEstimateSchema.
 */
export const validateDraft = (
  patientId: string,
  lines: DraftLine[]
): { ok: true } | { ok: false; message: string } => {
  if (!patientId) return { ok: false, message: 'Choose a companion for this estimate.' };
  if (lines.length === 0) return { ok: false, message: 'Add at least one line.' };
  for (const line of lines) {
    if (!line.description.trim()) {
      return { ok: false, message: 'Every line needs a description.' };
    }
    if (toNumber(line.quantity) <= 0) {
      return {
        ok: false,
        message: `Quantity for "${line.description.trim()}" must be above zero.`,
      };
    }
    if (toNumber(line.unitPrice) < 0) {
      return {
        ok: false,
        message: `Unit price for "${line.description.trim()}" cannot be negative.`,
      };
    }
    const taxRate = toNumber(line.taxRate);
    if (taxRate < 0 || taxRate > 100) {
      return {
        ok: false,
        message: `Tax for "${line.description.trim()}" must be between 0 and 100.`,
      };
    }
  }
  return { ok: true };
};

const CreateEstimateDialog = ({
  open,
  setOpen,
  companions,
  currency,
  saving,
  error,
  onSubmit,
}: CreateEstimateDialogProps) => {
  const [patientId, setPatientId] = useState('');
  const [notes, setNotes] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine('line-0')]);
  const [nextKey, setNextKey] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);

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
    setLines((current) => [...current, emptyLine(`line-${nextKey}`)]);
    setNextKey((key) => key + 1);
  };

  const removeLine = (key: string) =>
    setLines((current) =>
      current.length === 1 ? current : current.filter((line) => line.key !== key)
    );

  const handleSubmit = () => {
    const validation = validateDraft(patientId, lines);
    if (!validation.ok) {
      setFormError(validation.message);
      return;
    }
    setFormError(null);
    onSubmit({
      patientId,
      currency,
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

  return (
    <CenterModal
      showModal={open}
      setShowModal={setOpen}
      ariaLabel="Create an estimate"
      containerClassName="sm:w-[min(780px,92vw)]!"
    >
      <div className="flex flex-col gap-4 p-6!">
        <h2 className="text-heading-4 text-text-primary">New estimate</h2>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="estimate-companion"
            className="text-caption-2 font-bold text-text-tertiary"
          >
            Companion
          </label>
          <span className={fieldClass}>
            <select
              id="estimate-companion"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
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
          <label
            htmlFor="estimate-valid-until"
            className="text-caption-2 font-bold text-text-tertiary"
          >
            Valid until (optional)
          </label>
          <span className={`${fieldClass} max-w-60`}>
            <input
              id="estimate-valid-until"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className={inputClass}
            />
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-caption-2 font-bold text-text-tertiary">Lines</span>
          {/*
            Column headers, desktop only. The per-field labels below are visible on
            phone and screen-reader-only from sm up, so every field is named at
            every width - placeholders alone would leave the numeric boxes
            unidentifiable the moment a value is typed into them.
          */}
          <div
            className="hidden sm:grid grid-cols-[minmax(0,1fr)_4.5rem_6rem_4.5rem_auto_auto] items-end gap-2 text-caption-2 text-text-tertiary"
            aria-hidden="true"
          >
            <span>Description</span>
            <span>Qty</span>
            <span>Unit price</span>
            <span>Tax %</span>
            <span className="min-w-20 text-right">Line total</span>
            <span />
          </div>
          {lines.map((line, index) => (
            <div
              key={line.key}
              className="grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,1fr)_4.5rem_6rem_4.5rem_auto_auto] items-end gap-2"
            >
              <div className="flex flex-col gap-1 col-span-2 sm:col-span-1 min-w-0">
                <label
                  htmlFor={`${line.key}-description`}
                  className="text-caption-2 text-text-tertiary sm:sr-only"
                >
                  {`Line ${index + 1} description`}
                </label>
                <span className={fieldClass}>
                  <input
                    id={`${line.key}-description`}
                    type="text"
                    value={line.description}
                    placeholder="Description"
                    onChange={(e) => updateLine(line.key, { description: e.target.value })}
                    className={inputClass}
                  />
                </span>
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <label
                  htmlFor={`${line.key}-quantity`}
                  className="text-caption-2 text-text-tertiary sm:sr-only"
                >
                  {`Line ${index + 1} quantity`}
                </label>
                <span className={fieldClass}>
                  <input
                    id={`${line.key}-quantity`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={line.quantity}
                    placeholder="Qty"
                    onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                    className={inputClass}
                  />
                </span>
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <label
                  htmlFor={`${line.key}-unit-price`}
                  className="text-caption-2 text-text-tertiary sm:sr-only"
                >
                  {`Line ${index + 1} unit price`}
                </label>
                <span className={fieldClass}>
                  <input
                    id={`${line.key}-unit-price`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={line.unitPrice}
                    placeholder="Price"
                    onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                    className={inputClass}
                  />
                </span>
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <label
                  htmlFor={`${line.key}-tax-rate`}
                  className="text-caption-2 text-text-tertiary sm:sr-only"
                >
                  {`Line ${index + 1} tax percent`}
                </label>
                <span className={fieldClass}>
                  <input
                    id={`${line.key}-tax-rate`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    value={line.taxRate}
                    placeholder="Tax %"
                    onChange={(e) => updateLine(line.key, { taxRate: e.target.value })}
                    className={inputClass}
                  />
                </span>
              </div>
              <span className="text-body-4 text-text-secondary min-w-20 text-right pb-2! tabular-nums">
                {formatMoneyPrecise(
                  computeLineTotal(toNumber(line.quantity), toNumber(line.unitPrice)),
                  currency
                )}
              </span>
              <button
                type="button"
                onClick={() => removeLine(line.key)}
                disabled={lines.length === 1}
                aria-label={`Remove line ${index + 1}`}
                className="text-body-4 text-text-secondary hover:text-text-primary disabled:opacity-40 pb-2!"
              >
                Remove
              </button>
            </div>
          ))}
          <div>
            <Secondary text="Add line" onClick={addLine} ariaLabel="Add another estimate line" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="estimate-notes" className="text-caption-2 font-bold text-text-tertiary">
            Notes (optional)
          </label>
          <span className={fieldClass}>
            <textarea
              id="estimate-notes"
              value={notes}
              rows={2}
              onChange={(e) => setNotes(e.target.value)}
              className={inputClass}
            />
          </span>
        </div>

        <div className="flex flex-col gap-2 border-t border-t-card-border pt-3!">
          <div className="flex items-center justify-between">
            <span className="text-body-4 text-text-secondary">Subtotal</span>
            <span className="text-body-3 text-text-primary">
              {formatMoneyPrecise(totals.subtotal, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-body-4 text-text-secondary">Tax</span>
            <span className="text-body-3 text-text-primary">
              {formatMoneyPrecise(totals.taxAmount, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-body-4 text-text-secondary">Total</span>
            <span className="text-body-2 text-text-primary">
              {formatMoneyPrecise(totals.total, currency)}
            </span>
          </div>
        </div>

        {(formError ?? error) ? (
          <p role="alert" className="text-body-4 text-text-error">
            {formError ?? error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <Secondary
            text="Cancel"
            isDisabled={saving}
            onClick={() => setOpen(false)}
            ariaLabel="Cancel creating this estimate"
          />
          <Primary
            text={saving ? 'Creating...' : 'Create estimate'}
            isDisabled={saving}
            onClick={handleSubmit}
            ariaLabel="Create this estimate"
          />
        </div>
      </div>
    </CenterModal>
  );
};

export default CreateEstimateDialog;
