import type { CreditNote } from '@yosemite-crew/types';
import { postData } from '@/app/services/axios';

/**
 * Credit notes live on the invoice router, which is mounted at `/fhir/v1/invoice`
 * rather than under `/v1/finance` like the rest of the finance API. The split is
 * load-bearing: posting these to the finance prefix 404s.
 */
const creditNotesPath = (invoiceId: string) => `/fhir/v1/invoice/${invoiceId}/credit-notes`;

type FinanceEnvelope<T> = {
  data: T;
  meta?: unknown;
  error?: { code?: string; message?: string } | null;
};

const unwrap = <T>(value: T | FinanceEnvelope<T>): T => {
  if (value && typeof value === 'object' && 'data' in value) {
    const envelope = value as FinanceEnvelope<T>;
    if (envelope.error) {
      throw new Error(envelope.error.message || envelope.error.code || 'Finance request failed');
    }
    return envelope.data;
  }
  return value as T;
};

/**
 * Human-readable message from a credit-note failure.
 *
 * The invoice controller replies with a bare `{ message }` on failure, not the
 * success envelope, and axios only carries "Request failed with status code N"
 * on `error.message` - so the body has to be read. The messages worth surfacing
 * verbatim are the service's own 409s: "Credit note amount exceeds invoice
 * remaining amount" and "Invoice cannot accept credit notes."
 */
export const getCreditNoteErrorMessage = (error: unknown, fallback: string): string => {
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data;
  if (typeof data === 'object' && data !== null) {
    const body = data as { message?: unknown; error?: { message?: unknown } };
    const message = body.error?.message ?? body.message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return fallback;
};

export type IssueCreditNoteInput = {
  amount: number;
  reason?: string;
};

export const issueCreditNote = async (
  invoiceId: string,
  input: IssueCreditNoteInput
): Promise<CreditNote> => {
  if (!invoiceId) throw new Error('Invoice ID missing');
  const res = await postData<CreditNote | FinanceEnvelope<CreditNote>>(creditNotesPath(invoiceId), {
    amount: input.amount,
    ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
  });
  return unwrap(res.data);
};

export const voidCreditNote = async (
  invoiceId: string,
  creditNoteId: string,
  reason?: string
): Promise<CreditNote> => {
  if (!invoiceId) throw new Error('Invoice ID missing');
  if (!creditNoteId) throw new Error('Credit note ID missing');
  const res = await postData<CreditNote | FinanceEnvelope<CreditNote>>(
    `${creditNotesPath(invoiceId)}/${creditNoteId}/void`,
    reason?.trim() ? { reason: reason.trim() } : {}
  );
  return unwrap(res.data);
};

/**
 * What is still creditable on an invoice.
 *
 * Mirrors the cap in `InvoiceService.issueCreditNote`: the total minus every
 * credit note currently ISSUED. Voided notes do not count, which is why the
 * filter is on status rather than simply summing the list.
 */
export const remainingCreditable = (
  totalAmount: number,
  creditNotes: readonly CreditNote[] | undefined
): number => {
  const issued = (creditNotes ?? [])
    .filter((note) => note.status === 'ISSUED')
    .reduce((sum, note) => sum + note.amount, 0);
  return Math.max(0, totalAmount - issued);
};
