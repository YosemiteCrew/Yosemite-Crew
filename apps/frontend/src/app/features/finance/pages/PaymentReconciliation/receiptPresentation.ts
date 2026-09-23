import type { Invoice } from '@yosemite-crew/types';
import { getInvoiceOutstanding } from '@/app/lib/financeMetrics';
import { getInvoiceNumberLabel } from '@/app/lib/invoice';
import type { StatusTone } from '@/app/ui/primitives/StatusPill/StatusPill';
import {
  PROVIDER_RECEIPT_STATUSES,
  type ProviderReceipt,
  type ProviderReceiptStatus,
} from '@/app/features/finance/types/providerReceipt';

/**
 * Presentation for the reconciliation queue, kept out of the component so each
 * mapping can be asserted on its own rather than through a render.
 */

export const ALL_STATUSES_KEY = 'all';

/**
 * User-facing words for the journal's states. The raw enum is never rendered -
 * `PARTIALLY_REFUNDED` in a table cell is a database detail leaking into a
 * screen a practice manager reads.
 */
const STATUS_LABELS: Record<ProviderReceiptStatus, string> = {
  UNATTRIBUTED: 'Unattributed',
  UNALLOCATED: 'Unallocated',
  PARTIALLY_REFUNDED: 'Partly refunded',
  ALLOCATED: 'Allocated',
  REFUNDED: 'Refunded',
};

/**
 * Colour by what the state asks of the operator, not by how it sounds.
 *
 * `UNATTRIBUTED` is danger because money whose owner is unknown is the one
 * state that cannot be left alone. `ALLOCATED` and `REFUNDED` are settled and
 * read as neutral/success. `UNALLOCATED` and `PARTIALLY_REFUNDED` are work in
 * the queue, so they warn without shouting.
 */
const STATUS_TONES: Record<ProviderReceiptStatus, StatusTone> = {
  UNATTRIBUTED: 'danger',
  UNALLOCATED: 'warning',
  PARTIALLY_REFUNDED: 'warning',
  ALLOCATED: 'success',
  REFUNDED: 'neutral',
};

export const statusLabel = (status: ProviderReceiptStatus): string => STATUS_LABELS[status];

export const statusTone = (status: ProviderReceiptStatus): StatusTone => STATUS_TONES[status];

/** Title-cased provider name. `STRIPE` is a wire value, not a word to show. */
export const providerLabel = (provider: string): string => {
  if (!provider) return 'Unknown';
  return provider.charAt(0).toUpperCase() + provider.slice(1).toLowerCase();
};

export type ReconciliationFilterOption = { key: string; name: string };

/**
 * The filter row. "All" first, then the states in queue-working order, which is
 * the order `PROVIDER_RECEIPT_STATUSES` is declared in.
 */
export const RECONCILIATION_STATUS_FILTERS: ReconciliationFilterOption[] = [
  { key: ALL_STATUSES_KEY, name: 'All' },
  ...PROVIDER_RECEIPT_STATUSES.map((status) => ({ key: status, name: statusLabel(status) })),
];

export const toStatusFilter = (key: string): ProviderReceiptStatus | undefined =>
  key === ALL_STATUSES_KEY ? undefined : (key as ProviderReceiptStatus);

/*
 * The window's boundaries are UTC instants, and the screen says so.
 *
 * The endpoint takes ISO 8601 with an offset precisely so nothing is inferred
 * from the operator's device: a range read at local midnight and applied to a
 * UTC `capturedAt` moves the boundary by hours, and two staff in different
 * timezones would reconcile different sets of money from the same two dates.
 * A date input can only give a bare day, so the day is pinned to UTC here and
 * the field labels say UTC rather than leaving the reader to guess.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const utcDayStart = (date: string): string | undefined =>
  ISO_DATE.test(date) ? `${date}T00:00:00.000Z` : undefined;

export const utcDayEnd = (date: string): string | undefined =>
  ISO_DATE.test(date) ? `${date}T23:59:59.999Z` : undefined;

/*
 * Built from UTC parts rather than `Intl.DateTimeFormat`.
 *
 * Intl's short month names are ICU data, not a contract: `en-GB` answers "Sep"
 * on one Node build and "Sept" on another, so an assertion on this string would
 * be an assertion about the runner's ICU version. The column has to read the
 * same in CI, in the bundle and in a screenshot, so the format is pinned here.
 */
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const pad2 = (value: number): string => String(value).padStart(2, '0');

/**
 * An instant, stated. Rendered in UTC and labelled with it, for the same reason
 * the filters are: a capture time shown in the reader's own timezone cannot be
 * compared with the window that selected it.
 */
export const formatCapturedAt = (iso: string): string => {
  if (!iso) return 'Unknown';
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return 'Unknown';
  const day = pad2(value.getUTCDate());
  const month = MONTHS[value.getUTCMonth()];
  const time = `${pad2(value.getUTCHours())}:${pad2(value.getUTCMinutes())}`;
  return `${day} ${month} ${value.getUTCFullYear()}, ${time} UTC`;
};

/**
 * What the provider is still holding for this capture: captured minus what it
 * has given back. Shown beside the captured figure so a partly refunded row
 * does not read as its full amount.
 */
export const netCaptured = (receipt: ProviderReceipt): number =>
  receipt.amount - receipt.refundedAmount;

/**
 * A provider reference is long and opaque. It is shown truncated with the full
 * value on the element's title, never silently cut - a reference a reader
 * cannot tell is incomplete is worse than one they can.
 */
export const truncateReference = (reference: string, keep = 12): string => {
  if (!reference) return 'Unknown';
  if (reference.length <= keep) return reference;
  return `${reference.slice(0, keep)}...`;
};

/*
 * Money arithmetic, at the same scale the service uses.
 *
 * `roundMoney` in `src/services/finance/pricing.ts` is what produced every
 * figure on the wire, so the screen's residual has to round the same way or a
 * form pre-filled with the remainder is refused by the endpoint as a hundredth
 * of a unit over. The epsilon is part of it: without it 0.1 + 0.2 rounds down.
 */
const MONEY_SCALE = 100;

export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * MONEY_SCALE) / MONEY_SCALE;

/**
 * What an operator may still apply from a capture.
 *
 * The same two subtractions as `allocatableResidual` on the service, for the
 * same two reasons: money already applied must not be applied again, and money
 * already given back was never available to apply at all. Mirrored rather than
 * derived from the status, because a PARTIALLY_REFUNDED capture with an
 * allocation against it has a residual the status alone cannot state.
 */
export const allocatableResidual = (receipt: ProviderReceipt): number =>
  roundMoney(Math.max(0, receipt.amount - receipt.refundedAmount - receipt.allocatedAmount));

/**
 * Whether this capture can be applied at all, in the terms the route refuses
 * in.
 *
 * Three of the route's refusals are knowable from the row in front of the
 * operator, and an action offered where the answer is already "no" is the
 * defect this issue is explicit about: a fully refunded capture
 * (`FULLY_REFUNDED`), one nobody owns yet (`NOT_ATTRIBUTED`), and one with
 * nothing left (`EXCEEDS_RESIDUAL` on any positive line).
 *
 * `ACCOUNT_MISMATCH` is deliberately NOT mirrored. Which merchant account
 * holds the funds is not on the row and cannot be inferred from it, so the
 * server stays the only thing that answers it - and it answers in a sentence
 * the dialog shows.
 */
export const canAllocate = (receipt: ProviderReceipt): boolean =>
  receipt.organisationId !== null &&
  receipt.status !== 'REFUNDED' &&
  allocatableResidual(receipt) > 0;

/**
 * Why the action is unavailable, for the operator rather than for the code.
 *
 * A disabled control with no reason beside it is the state people file support
 * tickets about. Returns null exactly when `canAllocate` is true, so the two
 * cannot disagree about whether there is anything to say.
 */
export const allocationBlockedReason = (receipt: ProviderReceipt): string | null => {
  if (receipt.organisationId === null) {
    return 'This capture has not been attributed to a practice yet, so it cannot be applied.';
  }
  if (receipt.status === 'REFUNDED') {
    return 'This capture has been refunded in full; there is nothing to apply.';
  }
  if (allocatableResidual(receipt) <= 0) {
    return 'Every part of this capture has already been applied.';
  }
  return null;
};

/**
 * Invoice states that can never take money.
 *
 * Read from the invoice's own status and not from its balance, because they
 * are different claims: a cancelled invoice can still show an outstanding
 * total, and `getInvoiceOutstanding` will report it when the backend sent a
 * settlement summary. Offering one would put money against a document nobody
 * is going to collect - and the route refuses it as `INVOICE_CLOSED` anyway.
 */
const CLOSED_INVOICE_STATUSES: ReadonlySet<string> = new Set(['CANCELLED', 'REFUNDED']);

export type AllocatableInvoice = {
  id: string;
  label: string;
  currency: string;
  /** What this invoice still owes. The most a single line against it may be. */
  balance: number;
  createdAt: string;
};

/**
 * The invoices this capture may be applied to, in the route's own terms.
 *
 * Every condition here is one the allocate route checks, mirrored so the
 * picker cannot offer a row the write will refuse: same currency as the
 * capture, not a closed document, and something still owed. The organisation
 * is not re-checked because it is not a filter that could pass - the store
 * holds one organisation's invoices and an allocatable receipt is in that same
 * organisation.
 *
 * The server stays authoritative. This narrows a list; it does not decide
 * anything, and a balance that moved since the page loaded is refused there
 * with a sentence this screen shows.
 */
export const allocatableInvoices = (
  invoices: readonly Invoice[],
  receipt: ProviderReceipt
): AllocatableInvoice[] =>
  invoices
    .filter(
      (invoice) =>
        typeof invoice.id === 'string' &&
        invoice.id !== '' &&
        invoice.currency === receipt.currency &&
        !CLOSED_INVOICE_STATUSES.has(invoice.status) &&
        getInvoiceOutstanding(invoice) > 0
    )
    .map((invoice) => ({
      id: invoice.id as string,
      label: getInvoiceNumberLabel(invoice) || 'Invoice',
      currency: invoice.currency,
      balance: roundMoney(getInvoiceOutstanding(invoice)),
      createdAt: new Date(invoice.createdAt).toISOString(),
    }));
