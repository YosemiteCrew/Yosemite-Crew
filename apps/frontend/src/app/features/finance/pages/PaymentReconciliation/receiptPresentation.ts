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
