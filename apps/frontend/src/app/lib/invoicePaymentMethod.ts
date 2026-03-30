import { Invoice } from '@yosemite-crew/types';

const toNormalizedMethod = (method: unknown): string =>
  String(method ?? '')
    .trim()
    .replaceAll(/[\s-]+/g, '_')
    .toUpperCase();

const toFriendlyText = (value: string): string =>
  value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');

export const getPaymentCollectionMethodLabel = (method: unknown): string => {
  const normalizedMethod = toNormalizedMethod(method);
  if (!normalizedMethod) return '-';

  if (normalizedMethod === 'PAYMENT_AT_CLINIC') {
    return 'Paid in cash';
  }

  if (normalizedMethod === 'PAYMENT_LINK' || normalizedMethod === 'PAYMENT_INTENT') {
    return 'Online payment';
  }

  return toFriendlyText(normalizedMethod);
};

export const getInvoicePaymentMethodLabel = (invoice?: Invoice | null): string => {
  if (!invoice) return '-';

  const paymentCollectionMethodLabel = getPaymentCollectionMethodLabel(
    (invoice as any).paymentCollectionMethod
  );
  if (paymentCollectionMethodLabel !== '-') return paymentCollectionMethodLabel;

  if (
    invoice.stripeReceiptUrl ||
    invoice.stripeChargeId ||
    invoice.stripePaymentIntentId ||
    invoice.stripeCheckoutSessionId
  ) {
    return 'Online payment';
  }

  return '-';
};
