'use client';
import React, { useMemo, useState } from 'react';
import type { CreditNote } from '@yosemite-crew/types';
import { formatMoney } from '@/app/lib/money';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import {
  acceptsCreditNotes,
  isIssued,
  remainingCreditable,
} from '@/app/features/finance/services/creditNoteService';
import CreditNoteLedger from '@/app/features/finance/pages/Finance/Sections/CreditNoteLedger';
import CreditNoteIssueForm from '@/app/features/finance/pages/Finance/Sections/CreditNoteIssueForm';

export type CreditNoteAction =
  { type: 'issue'; amount: number; reason?: string } | { type: 'void'; creditNoteId: string };

type InvoiceCreditNotesProps = {
  creditNotes: CreditNote[] | undefined;
  totalAmount: number;
  /** The invoice's status: CANCELLED and REFUNDED cannot take a credit note. */
  status: string | undefined;
  currency: string;
  /** True while a credit note is being issued or voided, so actions lock. */
  busy: boolean;
  error: string | null;
  /** Bumped when the server accepts a credit note, so the form clears then. */
  issuedToken: number;
  onAction: (action: CreditNoteAction) => void;
};

/**
 * The credit ledger on an invoice, and the controls to credit more or reverse
 * one.
 *
 * Issuing a credit note has a side effect worth knowing about: the service
 * cancels every PaymentAttempt on the invoice that is not already SUCCEEDED or
 * CANCELED, because an outstanding Stripe checkout link still names the old
 * amount and would collect the full sum. That is why the form's copy warns
 * about open payment links rather than staying silent.
 */
const InvoiceCreditNotes = ({
  creditNotes,
  totalAmount,
  status,
  currency,
  busy,
  error,
  issuedToken,
  onAction,
}: InvoiceCreditNotesProps) => {
  const [formError, setFormError] = useState<string | null>(null);

  const notes = useMemo(() => creditNotes ?? [], [creditNotes]);
  const issuedNotes = useMemo(() => notes.filter(isIssued), [notes]);
  const credited = useMemo(
    () => issuedNotes.reduce((sum, note) => sum + note.amount, 0),
    [issuedNotes]
  );
  const remaining = remainingCreditable(totalAmount, notes);
  const creditable = acceptsCreditNotes(status);
  const message = formError ?? error;

  return (
    <section className="flex flex-col gap-3" aria-label="Credit notes">
      <h3 className="text-[13px] font-bold text-[var(--ink)]">Credit notes</h3>
      <div className="rounded-[14px] border border-card-border px-4.5 py-4 flex flex-col gap-3">
        <CreditNoteLedger
          notes={notes}
          currency={currency}
          busy={busy}
          onVoid={(creditNoteId) => onAction({ type: 'void', creditNoteId })}
        />

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
          {creditable && remaining > 0 && (
            <CreditNoteIssueForm
              remaining={remaining}
              currency={currency}
              busy={busy}
              issuedToken={issuedToken}
              onIssue={(draft) => onAction({ type: 'issue', ...draft })}
              onInvalid={setFormError}
              onValid={() => setFormError(null)}
            />
          )}
          {creditable && remaining <= 0 && (
            <p className="text-[12px] text-[var(--ink-muted)] border-t border-t-card-border pt-3!">
              This invoice is fully credited.
            </p>
          )}
          {!creditable && (
            <p className="text-[12px] text-[var(--ink-muted)] border-t border-t-card-border pt-3!">
              {`A ${String(status).toLowerCase()} invoice cannot take a credit note.`}
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
