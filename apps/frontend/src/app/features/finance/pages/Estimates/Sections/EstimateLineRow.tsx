'use client';
import React from 'react';
import { formatMoneyPrecise } from '@/app/lib/money';
import { computeLineTotal } from '@/app/features/finance/pages/Estimates/Sections/estimateTotals';
import {
  fieldClass,
  inputClass,
  toNumber,
  type DraftLine,
} from '@/app/features/finance/pages/Estimates/Sections/estimateDraft';

type EstimateLineRowProps = {
  line: DraftLine;
  index: number;
  currency: string;
  canRemove: boolean;
  onChange: (key: string, patch: Partial<DraftLine>) => void;
  onRemove: (key: string) => void;
};

type NumericFieldProps = {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  max?: number;
  onChange: (value: string) => void;
};

/**
 * Labels are visible on phone and screen-reader-only from sm up, where the
 * column headers name the fields instead. A placeholder alone would leave the
 * numeric boxes unidentifiable the moment a value is typed into them.
 */
const NumericField = ({ id, label, value, placeholder, max, onChange }: NumericFieldProps) => (
  <div className="flex flex-col gap-1 min-w-0">
    <label htmlFor={id} className="text-caption-2 text-text-tertiary sm:sr-only">
      {label}
    </label>
    <span className={fieldClass}>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        max={max}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </span>
  </div>
);

/** One editable estimate line: description, quantity, unit price, tax and its running total. */
const EstimateLineRow = ({
  line,
  index,
  currency,
  canRemove,
  onChange,
  onRemove,
}: EstimateLineRowProps) => (
  <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,1fr)_4.5rem_6rem_4.5rem_auto_auto] items-end gap-2">
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
          onChange={(e) => onChange(line.key, { description: e.target.value })}
          className={inputClass}
        />
      </span>
    </div>

    <NumericField
      id={`${line.key}-quantity`}
      label={`Line ${index + 1} quantity`}
      value={line.quantity}
      placeholder="Qty"
      onChange={(quantity) => onChange(line.key, { quantity })}
    />
    <NumericField
      id={`${line.key}-unit-price`}
      label={`Line ${index + 1} unit price`}
      value={line.unitPrice}
      placeholder="Price"
      onChange={(unitPrice) => onChange(line.key, { unitPrice })}
    />
    <NumericField
      id={`${line.key}-tax-rate`}
      label={`Line ${index + 1} tax percent`}
      value={line.taxRate}
      placeholder="Tax %"
      max={100}
      onChange={(taxRate) => onChange(line.key, { taxRate })}
    />

    <span className="text-body-4 text-text-secondary min-w-20 text-right pb-2! tabular-nums">
      {formatMoneyPrecise(
        computeLineTotal(toNumber(line.quantity), toNumber(line.unitPrice)),
        currency
      )}
    </span>
    <button
      type="button"
      onClick={() => onRemove(line.key)}
      disabled={!canRemove}
      aria-label={`Remove line ${index + 1}`}
      className="text-body-4 text-text-secondary hover:text-text-primary disabled:opacity-40 pb-2!"
    >
      Remove
    </button>
  </div>
);

export default EstimateLineRow;
