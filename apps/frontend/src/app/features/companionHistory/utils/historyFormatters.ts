import { HistoryEntry, HistoryEntryType } from '@/app/features/companionHistory/types/history';

type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const DATE_ONLY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export const formatHistoryDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return DATE_TIME_FORMATTER.format(date);
};

export const formatHistoryDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return DATE_ONLY_FORMATTER.format(date);
};

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

export const getPrimaryActionLabel = (entry: HistoryEntry) => {
  if (entry.type === 'DOCUMENT') return 'Open file';
  if (entry.type === 'LAB_RESULT') return 'Open result';
  if (entry.type === 'INVOICE') return 'Open finance';
  if (entry.type === 'FORM_SUBMISSION') return 'Open submission';
  if (entry.type === 'TASK') return 'Open task';
  return 'Open appointment';
};
