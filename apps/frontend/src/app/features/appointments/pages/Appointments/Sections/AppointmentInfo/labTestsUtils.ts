import type { IdexxTest, LabOrder } from '@/app/features/integrations/services/types';
import type { StatusTone } from '@/app/ui/primitives/StatusPill/StatusPill';
import { getSafeIdexxIframeUrl } from '@/app/lib/urls';

export const formatTestPrice = (test: IdexxTest) => {
  const amount = String(test.meta?.listPrice ?? '').trim();
  if (!amount) return 'Rate unavailable';
  const currency = String(test.meta?.currencyCode ?? '').trim();
  if (!currency) return amount;
  const numericAmount = Number.parseFloat(amount.replaceAll(',', '.').replaceAll(/[^0-9.+-]/g, ''));
  if (!Number.isFinite(numericAmount)) return `${currency.toUpperCase()} ${amount}`;
  try {
    return numericAmount.toLocaleString(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
      currencyDisplay: 'symbol',
    });
  } catch {
    return `${currency.toUpperCase()} ${amount}`;
  }
};

export const getTestTurnaround = (test: IdexxTest) =>
  String(test.meta?.turnaround ?? '').trim() || 'TAT not listed';

export const getTestSpecimen = (test: IdexxTest) =>
  String(test.meta?.specimen ?? '').trim() || 'Specimen not listed';

export const toTitleCase = (value?: string | null) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '-';
  const normalized = raw.toLowerCase().replaceAll(/[_-]+/g, ' ');
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export const resolveOrderUiUrl = (order: LabOrder | null) => {
  if (!order) return '';
  const nested = String(
    (order as unknown as { responsePayload?: { uiURL?: string } })?.responsePayload?.uiURL ?? ''
  ).trim();
  const raw = String(order.uiUrl ?? '').trim() || nested;
  return getSafeIdexxIframeUrl(raw);
};

export const resolveOrderPdfUrl = (order: LabOrder | null) => {
  if (!order) return '';
  const nested = String(
    (order as unknown as { responsePayload?: { pdfURL?: string } })?.responsePayload?.pdfURL ?? ''
  ).trim();
  const raw = String(order.pdfUrl ?? '').trim() || nested;
  return getSafeIdexxIframeUrl(raw);
};

export const getOrderStatusBadgeClass = (
  order: LabOrder,
  resultProgressByOrderId: Map<string, string>
) => {
  const resultProgress = resultProgressByOrderId.get(String(order.idexxOrderId ?? '').trim());
  if (resultProgress === 'Complete') return 'bg-green-50 text-green-800';
  if (resultProgress === 'In process') return 'bg-amber-50 text-amber-700';
  if (resultProgress === 'Error') return 'bg-red-50 text-red-700';
  const key = String(order.status ?? '').toLowerCase();
  if (key.includes('submitted') || key.includes('complete') || key.includes('final'))
    return 'bg-green-50 text-green-800';
  if (key.includes('created') || key.includes('pending')) return 'bg-amber-50 text-amber-700';
  if (key.includes('error') || key.includes('failed') || key.includes('cancel'))
    return 'bg-red-50 text-red-700';
  return 'bg-card-hover text-text-secondary';
};

export const getOrderStatusTone = (
  order: LabOrder,
  resultProgressByOrderId: Map<string, string>
): StatusTone => {
  const badgeClass = getOrderStatusBadgeClass(order, resultProgressByOrderId);
  if (badgeClass.startsWith('bg-green-50')) return 'success';
  if (badgeClass.startsWith('bg-red-50')) return 'danger';
  if (badgeClass.startsWith('bg-amber-50')) return 'warning';
  return 'neutral';
};
