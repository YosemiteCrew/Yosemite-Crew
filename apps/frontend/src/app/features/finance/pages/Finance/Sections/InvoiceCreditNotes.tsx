'use client';
import React, { useMemo, useState } from 'react';
import type { CreditNote } from '@yosemite-crew/types';
import { currencySymbol, formatMoney } from '@/app/lib/money';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import { Secondary } from '@/app/ui/primitives/Buttons';
import { remainingCreditable } from '@/app/features/finance/services/creditNoteService';

export type CreditNoteAction =
  { type: 'issue'; amount: number; reason?: string } | { type: 'void'; creditNoteId: string };

type InvoiceCreditNotesProps = {
  creditNotes: CreditNote[] | undefined;
  totalAmount: number;
  currency: string;
  /** True while a credit note is being issued or voided, so actions lock. */
  busy: boolean;
  error: string | null;
  onAction: (action: CreditNoteAction) => void;
};

const isIssued = (note: CreditNote) => note.status === 'ISSUED';

/**
 * The cap, to the penny.
 *
 * `formatMoney` runs at `maximumFractionDigits: 0`, which is right for the
 * ledger rows beside the rest of the invoice panel but wrong for this one
 * figure: a remaining 159.97 advertised as "160" invites the user to type 160
 * and take a 409 back from the service, whose own cap is exact.
 */
const formatCap = (amount: number, currency: string) =>
  `${currencySymbol(currency)}${amount.toFixed(2)}`;

/**
 * The credit ledger on an invoice: what has been credited, and the controls to
 * credit more or reverse one.
 *
 * The amount field is capped client-side at what the service will accept - the
 * invoice total minus every ISSUED note - so the common mistake produces a
 * message here rather than a 409 from the API. The server check remains the
 * authority; this only saves a round trip.
 *
 * Issuing a credit note has a side effect worth knowing about: the service
 * cancels every PaymentAttempt on the invoice that is not already SUCCEEDED or
 * CANCELED, because an outstanding Stripe checkout link still names the old
 * amount and would collect the full sum. That is why the copy warns about open
 * payment links rather than staying silent.
 */
const InvoiceCreditNotes = ({
  creditNotes,
  totalAmount,
  currency,
  busy,
  error,
  onAction,
}: InvoiceCreditNotesProps) => {
  const [amountInput, setAmountInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const notes = useMemo(() => creditNotes ?? [], [creditNotes]);
  const issuedNotes = useMemo(() => notes.filter(isIssued), [notes]);
  const credited = useMemo(
    () => issuedNotes.reduce((sum, note) => sum + note.amount, 0),
    [issuedNotes]
  );
  const remaining = remainingCreditable(totalAmount, notes);

  const handleIssue = () => {
    const amount = Number(amountInput.trim());
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Enter a credit amount above zero.');
      return;
    }
    if (amount > remaining) {
      setFormError(
        `The most that can still be credited on this invoice is ${formatCap(remaining, currency)}.`
      );
      return;
    }
    setFormError(null);
    onAction({ type: 'issue', amount, reason: reasonInput.trim() || undefined });
    setAmountInput('');
    setReasonInput('');
  };

  const message = formError ?? error;

  return (
    <section className="flex flex-col gap-3" aria-label="Credit notes">
      <h3 className="text-[13px] font-bold text-[var(--ink)]">Credit notes</h3>
      <div className="rounded-[14px] border border-card-border px-4.5 py-4 flex flex-col gap-3">
        {notes.length === 0 ? (
          <p className="text-[13px] text-[var(--ink-muted)]">
            Nothing has been credited against this invoice.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {notes.map((note) => (
              <li key={note.id} className="flex items-center justify-between gap-3">
                <span className="flex flex-col">
                  <span className="text-[13px] text-[var(--ink-body)]">
                    {note.creditNoteNumber}
                    {note.status === 'VOIDED' ? ' (voided)' : ''}
                  </span>
                  {note.reason ? (
                    <span className="text-[12px] text-[var(--ink-muted)]">{note.reason}</span>
                  ) : null}
                </span>
                <span className="flex items-center gap-3">
                  <span
                    className="tabular-nums text-[13px] font-semibold text-[var(--ink-body)]"
                    style={
                      note.status === 'VOIDED' ? { textDecoration: 'line-through' } : undefined
                    }
                  >
                    {formatMoney(note.amount, currency)}
                  </span>
                  {isIssued(note) && (
                    <PermissionGate allOf={[PERMISSIONS.BILLING_EDIT_ANY]}>
                      <Secondary
                        text="Void"
                        size="compact"
                        isDisabled={busy}
                        onClick={() => onAction({ type: 'void', creditNoteId: note.id })}
                        ariaLabel={`Void credit note ${note.creditNoteNumber}`}
                      />
                    </PermissionGate>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {issuedNotes.length > 0 && (
          <>
            <span className="h-px bg-card-border" aria-hidden="true" />
            <div className="flex items-center justify-between text-[13px] text-[var(--ink-muted)]">
              <span>Credited</span>
              <span className="tabular-nums text-[13px] font-bold text-[var(--ink-body)]">
                {formatMoney(credited, currency)}
              </span>
            </div>
          </>
        )}

        <PermissionGate allOf={[PERMISSIONS.BILLING_EDIT_ANY]}>
          {remaining > 0 ? (
            <div className="flex flex-col gap-2 border-t border-t-card-border pt-3!">
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1 w-32">
                  <label
                    htmlFor="credit-note-amount"
                    className="text-[12px] text-[var(--ink-muted)]"
                  >
                    Amount
                  </label>
                  <span className="flex items-stretch overflow-hidden rounded-2xl border border-input-border-default focus-within:border-input-border-active">
                    <input
                      id="credit-note-amount"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={remaining}
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[13px] text-[var(--ink-body)] outline-none"
                    />
                  </span>
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-40">
                  <label
                    htmlFor="credit-note-reason"
                    className="text-[12px] text-[var(--ink-muted)]"
                  >
                    Reason (optional)
                  </label>
                  <span className="flex items-stretch overflow-hidden rounded-2xl border border-input-border-default focus-within:border-input-border-active">
                    <input
                      id="credit-note-reason"
                      type="text"
                      value={reasonInput}
                      onChange={(e) => setReasonInput(e.target.value)}
                      className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[13px] text-[var(--ink-body)] outline-none"
                    />
                  </span>
                </div>
                <Secondary
                  text={busy ? 'Working...' : 'Issue credit note'}
                  isDisabled={busy}
                  onClick={handleIssue}
                  ariaLabel="Issue a credit note against this invoice"
                />
              </div>
              <p className="text-[12px] text-[var(--ink-muted)]">
                {`Up to ${formatCap(remaining, currency)} can still be credited. Issuing one cancels any open payment link on this invoice, because it would still charge the old amount.`}
              </p>
            </div>
          ) : (
            <p className="text-[12px] text-[var(--ink-muted)] border-t border-t-card-border pt-3!">
              This invoice is fully credited.
            </p>
          )}
        </PermissionGate>

        {message ? (
          <p role="alert" className="text-[13px] text-text-error">
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
};

export default InvoiceCreditNotes;
