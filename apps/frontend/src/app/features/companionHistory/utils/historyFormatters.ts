import { HistoryEntry, HistoryEntryType } from '@/app/features/companionHistory/types/history';
import { formatDateTimeLocal, formatDisplayDate } from '@/app/lib/date';

type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

/**
 * The History tab and the Audit tab are two tabs of one companion record showing
 * overlapping events, and the Audit tab stamps its rows with `formatDateTimeLocal`
 * (CompanionHistoryTimeline.tsx). These two were module-scope `Intl.DateTimeFormat`
 * instances with no `timeZone`, so they resolved to the DEVICE zone while the tab
 * next to them used the clinic's preferred zone: one event read "Sep 3, 2026,
 * 9:05 PM" on History and "Sep 3, 2026, 10:05 PM" on Audit, and near midnight the
 * two tabs disagreed on the date. The shared helpers pin `getPreferredTimeZone()`.
 *
 * The clock also widens from `hour: 'numeric'` to `hour: '2-digit'` as a
 * consequence ("9:05 PM" -> "09:05 PM"), which is what every other timestamp in
 * the product built on `formatDateTimeLocal` already shows.
 */
export const formatHistoryDateTime = (value?: string | null) => formatDateTimeLocal(value, '-');

export const formatHistoryDate = (value?: string | null) => formatDisplayDate(value, '-');

export const getHistoryTypeLabel = (type: HistoryEntryType): string => {
  if (type === 'FORM_SUBMISSION') return 'SOAP / Form';
  if (type === 'LAB_RESULT') return 'Lab';
  if (type === 'INVOICE') return 'Finance';
  return type.charAt(0) + type.slice(1).toLowerCase();
};

export const getTypeBadgeClassName = (type: HistoryEntryType) => {
  if (type === 'APPOINTMENT') return 'bg-blue-50 text-blue-700';
  if (type === 'TASK') return 'bg-violet-50 text-violet-700';
  if (type === 'FORM_SUBMISSION') return 'bg-cyan-50 text-cyan-700';
  if (type === 'DOCUMENT') return 'bg-amber-50 text-amber-700';
  if (type === 'LAB_RESULT') return 'bg-teal-50 text-teal-700';
  return 'bg-emerald-50 text-emerald-700';
};

export const getHistoryTypeBadgeTone = (type: HistoryEntryType): BadgeTone => {
  if (type === 'APPOINTMENT') return 'brand';
  if (type === 'TASK') return 'warning';
  if (type === 'FORM_SUBMISSION') return 'brand';
  if (type === 'DOCUMENT') return 'neutral';
  if (type === 'LAB_RESULT') return 'success';
  return 'brand';
};

export const getHistoryStatusBadgeTone = (status?: string | null): BadgeTone => {
  const normalized = String(status ?? '')
    .trim()
    .toUpperCase();

  if (!normalized) return 'neutral';

  const successStatuses = new Set(['COMPLETED', 'PAID', 'SIGNED', 'APPROVED', 'DONE']);
  if (successStatuses.has(normalized)) return 'success';

  const warningStatuses = new Set(['PENDING', 'AWAITING_PAYMENT', 'IN_PROGRESS', 'REQUESTED']);
  if (warningStatuses.has(normalized)) return 'warning';

  const dangerStatuses = new Set([
    'CANCELLED',
    'CANCELED',
    'REJECTED',
    'FAILED',
    'OVERDUE',
    'VOID',
  ]);
  if (dangerStatuses.has(normalized)) return 'danger';

  return 'neutral';
};

export const getPayloadString = (
  payload: Record<string, unknown>,
  keys: string[]
): string | null => {
  for (const key of keys) {
    const rawValue = payload[key];
    if (typeof rawValue === 'string' && rawValue.trim()) {
      return rawValue;
    }
  }
  return null;
};

export const getPayloadNumber = (
  payload: Record<string, unknown>,
  keys: string[]
): number | null => {
  for (const key of keys) {
    const rawValue = payload[key];
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      return rawValue;
    }
    if (typeof rawValue === 'string') {
      const parsed = Number(rawValue);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
};

export const getPayloadBoolean = (
  payload: Record<string, unknown>,
  keys: string[]
): boolean | null => {
  for (const key of keys) {
    const rawValue = payload[key];
    if (typeof rawValue === 'boolean') {
      return rawValue;
    }
  }
  return null;
};

export const formatCurrency = (
  amount: number | null,
  currencyCode?: string | null
): string | null => {
  if (amount === null) return null;
  const resolvedCurrency = currencyCode?.toUpperCase() || 'USD';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: resolvedCurrency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${resolvedCurrency} ${amount.toFixed(2)}`;
  }
};

/**
 * The document-store id for an entry, or null when the record does not live in
 * the document store. Only DOCUMENT rows carry one: `link.id` is a document id
 * exclusively when the link itself is a document link, because a lab result's,
 * invoice's or task's link id belongs to a different service and would be
 * rejected by the document download endpoint.
 */
export const resolveHistoryDocumentId = (entry: HistoryEntry): string | null => {
  const payloadDocumentId = getPayloadString(entry.payload, ['documentId']);
  if (payloadDocumentId) return payloadDocumentId.trim();
  const linkKind = String(entry.link.kind ?? '')
    .trim()
    .toLowerCase();
  const linkId = String(entry.link.id ?? '').trim();
  return linkKind === 'document' && linkId ? linkId : null;
};

export const getPrimaryActionLabel = (entry: HistoryEntry) => {
  if (entry.type === 'DOCUMENT') return 'Open file';
  if (entry.type === 'LAB_RESULT') return 'Open result';
  if (entry.type === 'INVOICE') return 'Open finance';
  if (entry.type === 'FORM_SUBMISSION') return 'Open submission';
  if (entry.type === 'TASK') return 'Open task';
  return 'Open appointment';
};
