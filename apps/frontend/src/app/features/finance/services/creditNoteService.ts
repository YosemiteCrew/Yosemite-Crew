import type { CreditNote } from '@yosemite-crew/types';
import { postData } from '@/app/services/axios';
import { currencySymbol } from '@/app/lib/money';

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
 * Round to cents exactly the way the backend's `roundMoney` does
 * (`apps/backend/src/services/finance/pricing.ts`).
 *
 * Not cosmetic. Without it the raw subtraction leaves float dust - a total of
 * 10.01 against an issued 0.05 gives 9.959999999999999 - which the UI displays
 * as "9.96" while rejecting an entered 9.96 as over the cap, refusing the exact
 * figure it just advertised. The server, which rounds, would have accepted it.
 */
const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * What is still creditable on an invoice.
 *
 * Mirrors the cap in `InvoiceService.issueCreditNote`: the total minus every
 * credit note currently ISSUED, rounded to cents the same way. Voided notes do
 * not count, which is why the filter is on status rather than simply summing
 * the list.
 */
export const remainingCreditable = (
  totalAmount: number,
  creditNotes: readonly CreditNote[] | undefined
): number => {
  const issued = roundMoney(
    (creditNotes ?? [])
      .filter((note) => note.status === 'ISSUED')
      .reduce((sum, note) => sum + note.amount, 0)
  );
  return Math.max(0, roundMoney(totalAmount - issued));
};

/**
 * Whether the invoice's status lets it take a credit note at all.
 *
 * `InvoiceService.issueCreditNote` rejects CANCELLED and REFUNDED with a 409
 * regardless of the balance, so offering the form on one of those would invite
 * a request that can only fail.
 */
export const acceptsCreditNotes = (status: string | undefined): boolean =>
  status !== 'CANCELLED' && status !== 'REFUNDED';

/**
 * The cap, to the penny.
 *
 * `formatMoney` runs at `maximumFractionDigits: 0`, which is right for the
 * ledger rows beside the rest of the invoice panel but wrong for this one
 * figure: a remaining 159.97 advertised as "160" invites the user to type 160
 * and take a 409 back from the service, whose own cap is exact.
 */
export const formatCap = (amount: number, currency: string) =>
  `${currencySymbol(currency)}${amount.toFixed(2)}`;

/** An ISSUED note is the only kind that still reduces the invoice. */
export const isIssued = (note: CreditNote) => note.status === 'ISSUED';
