'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  /** Bumped on each accepted credit note, so the form knows when to clear. */
  issuedToken: number;
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

  const [issuedToken, setIssuedToken] = useState(0);
  const invoiceId = invoice?.id ?? null;

  /**
   * The invoice currently on screen, readable from a promise callback.
   *
   * A request started for invoice A can resolve after the user has closed A
   * and opened B on the same hook instance. Comparing the request's invoice
   * against this is what keeps A's result off B's panel. Tracking only the
   * last REQUESTED invoice is not enough: switching invoice without starting a
   * new request would leave the old value in place and A's result would still
   * match.
   *
   * Updated in an effect rather than during render - the repo lints against
   * touching a ref while rendering.
   */
  const displayedInvoiceId = useRef<string | null>(invoiceId);
  useEffect(() => {
    displayedInvoiceId.current = invoiceId;
  }, [invoiceId]);

  // Render-phase reset, the pattern useOrganisationDiscountCap uses: A's error
  // and spinner belong to a panel the user has closed, so they must not carry
  // over to B. State only - no ref is touched here.
  const [prevInvoiceId, setPrevInvoiceId] = useState(invoiceId);
  if (prevInvoiceId !== invoiceId) {
    setPrevInvoiceId(invoiceId);
    setBusy(false);
    setError(null);
  }

  const run = useCallback(
    (action: CreditNoteAction) => {
      if (!invoice?.id) return;
      const requestInvoiceId = invoice.id;
      setBusy(true);
      setError(null);

      const request =
        action.type === 'issue'
          ? issueCreditNote(requestInvoiceId, { amount: action.amount, reason: action.reason })
          : voidCreditNote(requestInvoiceId, action.creditNoteId);

      request
        .then((creditNote) => {
          if (displayedInvoiceId.current !== requestInvoiceId) return;
          upsertInvoice(mergeCreditNote(invoice, creditNote));
          if (action.type === 'issue') setIssuedToken((token) => token + 1);
          notify('success', {
            title: action.type === 'issue' ? 'Credit note issued' : 'Credit note voided',
            text:
              action.type === 'issue'
                ? 'The credit has been recorded against this invoice.'
                : 'The credit note no longer reduces this invoice.',
          });
        })
        .catch((err: unknown) => {
          if (displayedInvoiceId.current !== requestInvoiceId) return;
          const message = getCreditNoteErrorMessage(
            err,
            action.type === 'issue'
              ? 'The credit note could not be issued.'
              : 'The credit note could not be voided.'
          );
          setError(message);
          notify('error', { title: 'Credit note not saved', text: message });
        })
        .finally(() => {
          if (displayedInvoiceId.current !== requestInvoiceId) return;
          setBusy(false);
        });
    },
    [invoice, upsertInvoice, notify]
  );

  return { busy, error, issuedToken, run };
};
