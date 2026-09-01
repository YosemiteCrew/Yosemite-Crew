'use client';
import React from 'react';
import type { CreditNote } from '@yosemite-crew/types';
import { formatMoney } from '@/app/lib/money';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import { Secondary } from '@/app/ui/primitives/Buttons';

export const isIssued = (note: CreditNote) => note.status === 'ISSUED';

type CreditNoteLedgerProps = {
  notes: CreditNote[];
  currency: string;
  busy: boolean;
  onVoid: (creditNoteId: string) => void;
};

/**
 * Every credit note on the invoice, issued or voided.
 *
 * A voided note is struck through and keeps its row - removing it would hide
 * that a credit was raised and reversed, which is exactly the history a
 * practice needs when reconciling. Only an issued note offers a Void control.
 */
const CreditNoteLedger = ({ notes, currency, busy, onVoid }: CreditNoteLedgerProps) => {
  if (notes.length === 0) {
    return (
      <p className="text-[13px] text-[var(--ink-muted)]">
        Nothing has been credited against this invoice.
      </p>
    );
  }

  return (
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
              style={note.status === 'VOIDED' ? { textDecoration: 'line-through' } : undefined}
            >
              {formatMoney(note.amount, currency)}
            </span>
            {isIssued(note) && (
              <PermissionGate allOf={[PERMISSIONS.BILLING_EDIT_ANY]}>
                <Secondary
                  text="Void"
                  size="compact"
                  isDisabled={busy}
                  onClick={() => onVoid(note.id)}
                  ariaLabel={`Void credit note ${note.creditNoteNumber}`}
                />
              </PermissionGate>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
};

export default CreditNoteLedger;
