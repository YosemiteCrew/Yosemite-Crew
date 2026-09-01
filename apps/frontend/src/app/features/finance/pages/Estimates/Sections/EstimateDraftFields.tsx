'use client';
import React from 'react';
import { Secondary } from '@/app/ui/primitives/Buttons';
import { formatMoneyPrecise } from '@/app/lib/money';
import EstimateLineRow from '@/app/features/finance/pages/Estimates/Sections/EstimateLineRow';
import {
  fieldClass,
  inputClass,
  todayIsoDate,
  type DraftLine,
} from '@/app/features/finance/pages/Estimates/Sections/estimateDraft';
import type { EstimateTotals } from '@/app/features/finance/pages/Estimates/Sections/estimateTotals';

export type CompanionChoice = { id: string; name: string };

/** The companion picker and the optional expiry date. */
export const EstimateHeaderFields = ({
  companions,
  patientId,
  setPatientId,
  validUntil,
  setValidUntil,
}: {
  companions: CompanionChoice[];
  patientId: string;
  setPatientId: (value: string) => void;
  validUntil: string;
  setValidUntil: (value: string) => void;
}) => (
  <>
    <div className="flex flex-col gap-1">
      <label htmlFor="estimate-companion" className="text-caption-2 font-bold text-text-tertiary">
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
      <label htmlFor="estimate-valid-until" className="text-caption-2 font-bold text-text-tertiary">
        Valid until (optional)
      </label>
      <span className={`${fieldClass} max-w-60`}>
        <input
          id="estimate-valid-until"
          type="date"
          // A lapsed quote would still be sendable, approvable and convertible,
          // because nothing derives EXPIRED from this date.
          min={todayIsoDate()}
          value={validUntil}
          onChange={(e) => setValidUntil(e.target.value)}
          className={inputClass}
        />
      </span>
    </div>
  </>
);

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

/** The editable line items, with column headers on desktop. */
export const EstimateLineEditor = ({
  lines,
  currency,
  updateLine,
  removeLine,
  addLine,
}: {
  lines: DraftLine[];
  currency: string;
  updateLine: (key: string, patch: Partial<DraftLine>) => void;
  removeLine: (key: string) => void;
  addLine: () => void;
}) => (
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
);

/** Free-text notes carried onto the estimate. */
export const EstimateNotesField = ({
  notes,
  setNotes,
}: {
  notes: string;
  setNotes: (value: string) => void;
}) => (
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
);

const TotalsRow = ({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) => (
  <div className="flex items-center justify-between">
    <span className="text-body-4 text-text-secondary">{label}</span>
    <span className={emphasis ? 'text-body-2 text-text-primary' : 'text-body-3 text-text-primary'}>
      {value}
    </span>
  </div>
);

/** Running subtotal, tax and total, computed the way the backend computes them. */
export const EstimateTotalsPanel = ({
  totals,
  currency,
}: {
  totals: EstimateTotals;
  currency: string;
}) => (
  <div className="flex flex-col gap-2 border-t border-t-card-border pt-3!">
    <TotalsRow label="Subtotal" value={formatMoneyPrecise(totals.subtotal, currency)} />
    <TotalsRow label="Tax" value={formatMoneyPrecise(totals.taxAmount, currency)} />
    <TotalsRow label="Total" value={formatMoneyPrecise(totals.total, currency)} emphasis />
  </div>
);
