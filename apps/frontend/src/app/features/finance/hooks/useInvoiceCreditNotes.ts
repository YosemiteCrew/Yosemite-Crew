'use client';
import { useCallback, useState } from 'react';
import type { CreditNote, Invoice } from '@yosemite-crew/types';
import { useInvoiceStore } from '@/app/stores/invoiceStore';
import { useNotify } from '@/app/hooks/useNotify';
import {
  getCreditNoteErrorMessage,
  issueCreditNote,
  voidCreditNote,
} from '@/app/features/finance/services/creditNoteService';
import type { CreditNoteAction } from '@/app/features/finance/pages/Finance/Sections/InvoiceCreditNotes';

export type UseInvoiceCreditNotes = {
  busy: boolean;
  error: string | null;
  run: (action: CreditNoteAction) => void;
};

/** Merge one credit note back into the invoice already in the store. */
const mergeCreditNote = (invoice: Invoice, creditNote: CreditNote): Invoice => {
  const existing = invoice.creditNotes ?? [];
  const index = existing.findIndex((note) => note.id === creditNote.id);
  const creditNotes =
    index === -1
      ? [...existing, creditNote]
      : existing.map((note) => (note.id === creditNote.id ? creditNote : note));
  return { ...invoice, creditNotes };
};

/**
 * Issue or void a credit note on the open invoice.
 *
 * The result is merged straight back into the invoice store rather than
 * refetched, so the ledger and the credited total update in place.
 *
 * One caveat the UI cannot paper over: `settlementSummary` is not returned by
 * the finance list endpoint, so the invoice's Outstanding figure does not yet
 * respond to a credit note. That is tracked in #2595; crediting still shows
 * correctly here, in the credit ledger.
 */
export const useInvoiceCreditNotes = (invoice: Invoice | null): UseInvoiceCreditNotes => {
  const { notify } = useNotify();
  const upsertInvoice = useInvoiceStore((s) => s.upsertInvoice);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    (action: CreditNoteAction) => {
      if (!invoice?.id) return;
      const invoiceId = invoice.id;
      setBusy(true);
      setError(null);

      const request =
        action.type === 'issue'
          ? issueCreditNote(invoiceId, { amount: action.amount, reason: action.reason })
          : voidCreditNote(invoiceId, action.creditNoteId);

      request
        .then((creditNote) => {
          upsertInvoice(mergeCreditNote(invoice, creditNote));
          notify('success', {
            title: action.type === 'issue' ? 'Credit note issued' : 'Credit note voided',
            text:
              action.type === 'issue'
                ? 'The credit has been recorded against this invoice.'
                : 'The credit note no longer reduces this invoice.',
          });
        })
        .catch((err: unknown) => {
          const message = getCreditNoteErrorMessage(
            err,
            action.type === 'issue'
              ? 'The credit note could not be issued.'
              : 'The credit note could not be voided.'
          );
          setError(message);
          notify('error', { title: 'Credit note not saved', text: message });
        })
        .finally(() => setBusy(false));
    },
    [invoice, upsertInvoice, notify]
  );

  return { busy, error, run };
};
