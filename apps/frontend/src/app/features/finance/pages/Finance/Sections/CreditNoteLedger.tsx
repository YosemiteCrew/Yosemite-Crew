'use client';
import React, { useState } from 'react';
import { IoReturnDownBackOutline } from 'react-icons/io5';
import type { CreditNote } from '@yosemite-crew/types';
import { formatMoneyPrecise } from '@/app/lib/money';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import { Secondary } from '@/app/ui/primitives/Buttons';
import { isIssued } from '@/app/features/finance/services/creditNoteService';

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
 *
 * Voiding asks first. It cannot be undone from here, it moves money back onto
 * what the client owes, and the control is a compact button sitting inches from
 * the amount - a single mis-click should not be enough.
 */
const CreditNoteLedger = ({ notes, currency, busy, onVoid }: CreditNoteLedgerProps) => {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

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
        <li key={note.id} className="flex items-center gap-3">
          {/*
            The same row anatomy as the Payments ledger directly above: a
            tinted glyph, a bold line, a quiet caption, then the amount. The
            warning tint rather than the payments blue, because this is money
            going back off the invoice.
          */}
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-warning-100 text-text-primary">
            <IoReturnDownBackOutline size={15} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            {/*
              The reason leads and the reference captions it. A clinician
              reconciling reads "Goodwill on the delayed dental"; the
              CN-... string is the audit artifact, and it dominated the row
              at full body weight while the reason sat under it in grey.
            */}
            <span className="block text-[13px] font-bold text-[var(--ink)]">
              {note.reason || 'Credit note'}
              {note.status === 'VOIDED' ? ' (voided)' : ''}
            </span>
            <span
              className="block truncate text-[11.5px] text-text-tertiary"
              title={note.creditNoteNumber}
            >
              {note.creditNoteNumber}
            </span>
          </span>
          <span className="flex items-center gap-3">
            <span
              className="tabular-nums text-[13px] font-bold text-[var(--ink)]"
              style={note.status === 'VOIDED' ? { textDecoration: 'line-through' } : undefined}
            >
              {formatMoneyPrecise(note.amount, currency)}
            </span>
            {isIssued(note) && (
              <PermissionGate allOf={[PERMISSIONS.BILLING_EDIT_ANY]}>
                {confirmingId === note.id ? (
                  <span className="flex items-center gap-2">
                    <Secondary
                      text="Confirm void"
                      size="compact"
                      isDisabled={busy}
                      onClick={() => {
                        setConfirmingId(null);
                        onVoid(note.id);
                      }}
                      ariaLabel={`Confirm voiding credit note ${note.creditNoteNumber}`}
                    />
                    <Secondary
                      text="Cancel"
                      size="compact"
                      isDisabled={busy}
                      onClick={() => setConfirmingId(null)}
                      ariaLabel={`Keep credit note ${note.creditNoteNumber}`}
                    />
                  </span>
                ) : (
                  <Secondary
                    text="Void"
                    size="compact"
                    isDisabled={busy}
                    onClick={() => setConfirmingId(note.id)}
                    ariaLabel={`Void credit note ${note.creditNoteNumber}`}
                  />
                )}
              </PermissionGate>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
};

export default CreditNoteLedger;
