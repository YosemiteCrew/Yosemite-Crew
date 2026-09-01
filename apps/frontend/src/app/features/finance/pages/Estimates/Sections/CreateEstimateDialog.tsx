'use client';
import React, { useMemo, useRef, useState } from 'react';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { formatMoneyPrecise } from '@/app/lib/money';
import { computeEstimateTotals } from '@/app/features/finance/pages/Estimates/Sections/estimateTotals';
import EstimateLineRow from '@/app/features/finance/pages/Estimates/Sections/EstimateLineRow';
import {
  emptyLine,
  fieldClass,
  inputClass,
  toNumber,
  validateDraft,
  type DraftLine,
} from '@/app/features/finance/pages/Estimates/Sections/estimateDraft';
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

const LineColumnHeaders = () => (
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
);

type TotalsRowProps = { label: string; value: string; emphasis?: boolean };

const TotalsRow = ({ label, value, emphasis = false }: TotalsRowProps) => (
  <div className="flex items-center justify-between">
    <span className="text-body-4 text-text-secondary">{label}</span>
    <span className={emphasis ? 'text-body-2 text-text-primary' : 'text-body-3 text-text-primary'}>
      {value}
    </span>
  </div>
);

/**
 * The estimate editor.
 *
 * Totals come from `computeEstimateTotals`, which mirrors the backend's
 * `computeTotals` exactly, so the figure previewed here is the figure that is
 * saved. Validation mirrors the controller's zod schema for the same reason:
 * the user learns what is wrong before a request goes out.
 */
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
  const [formError, setFormError] = useState<string | null>(null);

  // A counter, not state: it only ever feeds the next React key, is never
  // rendered, and as state every increment would re-render the dialog for
  // nothing.
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
          <LineColumnHeaders />
          {lines.map((line, index) => (
            <EstimateLineRow
              key={line.key}
              line={line}
              index={index}
              currency={currency}
              canRemove={lines.length > 1}
              onChange={updateLine}
              onRemove={removeLine}
            />
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
          <TotalsRow label="Subtotal" value={formatMoneyPrecise(totals.subtotal, currency)} />
          <TotalsRow label="Tax" value={formatMoneyPrecise(totals.taxAmount, currency)} />
          <TotalsRow label="Total" value={formatMoneyPrecise(totals.total, currency)} emphasis />
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
