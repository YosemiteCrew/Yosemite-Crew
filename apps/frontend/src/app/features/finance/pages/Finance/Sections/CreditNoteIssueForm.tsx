'use client';
import React, { useState } from 'react';
import { Secondary } from '@/app/ui/primitives/Buttons';
import { formatCap } from '@/app/features/finance/services/creditNoteService';

type CreditNoteDraft = { amount: number; reason?: string };

type CreditNoteIssueFormProps = {
  remaining: number;
  currency: string;
  busy: boolean;
  /**
   * Increments each time the server accepts a credit note. The draft is only
   * cleared on that edge - clearing on submit loses the user's amount and
   * reason on any rejection or dropped connection, and they would have to
   * reconstruct both from the error message. A counter rather than a boolean
   * so a second successful issue also clears.
   */
  issuedToken: number;
  onIssue: (draft: CreditNoteDraft) => void;
  /** Raised when the draft is refused before any request goes out. */
  onInvalid: (message: string) => void;
  /** Clears a previous message once a draft is accepted. */
  onValid: () => void;
};

const fieldClass =
  'flex items-stretch overflow-hidden rounded-2xl border border-input-border-default focus-within:border-input-border-active';
const inputClass =
  'min-w-0 flex-1 bg-transparent px-3 py-2 text-[13px] text-[var(--ink-body)] outline-none';

/**
 * Amount and reason, validated against the same cap the service enforces so the
 * common mistake produces a message here rather than a 409. The server check
 * remains the authority; this only saves a round trip.
 */
const CreditNoteIssueForm = ({
  remaining,
  currency,
  busy,
  issuedToken,
  onIssue,
  onInvalid,
  onValid,
}: CreditNoteIssueFormProps) => {
  const [amountInput, setAmountInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');

  // Render-phase reset on the success edge, the pattern useOrganisationDiscountCap
  // uses: clearing inside the submit handler would discard the draft before the
  // server had accepted it.
  const [prevIssuedToken, setPrevIssuedToken] = useState(issuedToken);
  if (prevIssuedToken !== issuedToken) {
    setPrevIssuedToken(issuedToken);
    setAmountInput('');
    setReasonInput('');
  }

  const handleIssue = () => {
    const amount = Number(amountInput.trim());
    if (!Number.isFinite(amount) || amount <= 0) {
      onInvalid('Enter a credit amount above zero.');
      return;
    }
    if (amount > remaining) {
      onInvalid(
        `The most that can still be credited on this invoice is ${formatCap(remaining, currency)}.`
      );
      return;
    }
    onValid();
    onIssue({ amount, reason: reasonInput.trim() || undefined });
  };

  return (
    <div className="flex flex-col gap-2 border-t border-t-card-border pt-3!">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1 w-32">
          <label htmlFor="credit-note-amount" className="text-[12px] text-[var(--ink-muted)]">
            Amount
          </label>
          <span className={fieldClass}>
            <input
              id="credit-note-amount"
              type="number"
              inputMode="decimal"
              min={0}
              max={remaining}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className={inputClass}
            />
          </span>
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-40">
          <label htmlFor="credit-note-reason" className="text-[12px] text-[var(--ink-muted)]">
            Reason (optional)
          </label>
          <span className={fieldClass}>
            <input
              id="credit-note-reason"
              type="text"
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              className={inputClass}
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
        {`Up to ${formatCap(remaining, currency)} can still be credited. Any pending payment attempt on this invoice is marked cancelled, but a payment link already sent to the client keeps working and would charge the pre-credit amount - send a new one.`}
      </p>
    </div>
  );
};

export default CreditNoteIssueForm;
