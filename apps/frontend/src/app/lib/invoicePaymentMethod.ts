import { Invoice } from '@yosemite-crew/types';

const IN_PERSON_PAYMENT_LABEL = 'In-person payment';

const toNormalizedMethod = (method: unknown): string =>
  String(typeof method === 'string' || typeof method === 'number' ? method : '')
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
    return IN_PERSON_PAYMENT_LABEL;
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
