'use client';
import React from 'react';
import { formatMoneyPrecise } from '@/app/lib/money';
import type { AllocatableInvoice } from '@/app/features/finance/pages/PaymentReconciliation/receiptPresentation';
import type { ReviewedLine } from '@/app/features/finance/pages/PaymentReconciliation/allocationDraft';

const fieldClass =
  'w-28 rounded-2xl border border-input-border-default focus-within:border-input-border-active ' +
  'bg-transparent px-3 py-2 text-body-4 text-text-primary outline-none tabular-nums';

export const errorTextClass = 'text-caption-2 text-text-error';

type OptionRowProps = {
  invoice: AllocatableInvoice;
  /** Undefined while the invoice is not selected. */
  line: ReviewedLine | undefined;
  amount: string;
  disabled: boolean;
  onToggle: (invoiceId: string) => void;
  onAmountChange: (invoiceId: string, value: string) => void;
};

/**
 * One invoice, and what of the capture goes to it.
 *
 * The amount field appears only once the invoice is ticked: an empty box
 * beside every unselected invoice reads as a form with a dozen things to fill
 * in, when the operator is choosing one or two.
 */
const OptionRow = ({
  invoice,
  line,
  amount,
  disabled,
  onToggle,
  onAmountChange,
}: Readonly<OptionRowProps>) => {
  const amountId = `allocate-amount-${invoice.id}`;
  const errorId = `${amountId}-error`;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex flex-1 min-w-0 items-center gap-2 text-body-4 text-text-primary">
        <input
          type="checkbox"
          checked={line !== undefined}
          onChange={() => onToggle(invoice.id)}
          disabled={disabled}
        />
        <span className="truncate">{invoice.label}</span>
        <span className="text-caption-2 text-text-secondary whitespace-nowrap">
          {`${formatMoneyPrecise(invoice.balance, invoice.currency)} owed`}
        </span>
      </label>

      {line !== undefined && (
        <span className="flex flex-col gap-1">
          <label htmlFor={amountId} className="sr-only">
            {`Amount to apply to ${invoice.label}`}
          </label>
          <input
            id={amountId}
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => onAmountChange(invoice.id, e.target.value)}
            disabled={disabled}
            aria-invalid={line.error !== null}
            aria-describedby={line.error === null ? undefined : errorId}
            className={fieldClass}
          />
          {line.error !== null && (
            <span id={errorId} role="alert" className={errorTextClass}>
              {line.error}
            </span>
          )}
        </span>
      )}
    </div>
  );
};

type AllocationPickerProps = {
  options: readonly AllocatableInvoice[];
  lines: readonly ReviewedLine[];
  amounts: Readonly<Record<string, string>>;
  /** The invoice store has not answered yet. Distinct from "no eligible invoices". */
  loading: boolean;
  disabled: boolean;
  /** Only used to name the currency in the empty copy. */
  currency: string;
  onToggle: (invoiceId: string) => void;
  onAmountChange: (invoiceId: string, value: string) => void;
};

/**
 * The invoices a capture can be applied to.
 *
 * Three states, and the first two are different facts: still arriving, none
 * eligible, and a list. A picker rendered empty while the store is loading
 * reads as a screen that failed, and one rendered empty with no sentence reads
 * as a practice with no invoices rather than none this capture can pay.
 */
const AllocationPicker = ({
  options,
  lines,
  amounts,
  loading,
  disabled,
  currency,
  onToggle,
  onAmountChange,
}: Readonly<AllocationPickerProps>) => {
  if (loading) {
    return (
      <p className="text-body-4 text-text-secondary" aria-live="polite">
        {'Loading invoices...'}
      </p>
    );
  }

  if (options.length === 0) {
    return (
      <p className="text-body-4 text-text-secondary">
        {`No open invoice in ${currency} has an outstanding balance, so there is nothing to apply this capture to yet.`}
      </p>
    );
  }

  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0! m-0!">
      <legend className="text-caption-2 font-bold text-text-tertiary">
        {'Invoices this payment can be applied to'}
      </legend>
      {options.map((invoice) => (
        <OptionRow
          key={invoice.id}
          invoice={invoice}
          line={lines.find((entry) => entry.invoice.id === invoice.id)}
          amount={amounts[invoice.id] ?? ''}
          disabled={disabled}
          onToggle={onToggle}
          onAmountChange={onAmountChange}
        />
      ))}
    </fieldset>
  );
};

export default AllocationPicker;
