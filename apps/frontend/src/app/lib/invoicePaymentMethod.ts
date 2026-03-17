import { Invoice } from '@yosemite-crew/types';

export const getInvoicePaymentMethodLabel = (invoice?: Invoice | null): string => {
  if (!invoice) return '-';

  const paymentCollectionMethod = String(
    (invoice as any).paymentCollectionMethod ?? ''
  ).toUpperCase();

  if (paymentCollectionMethod === 'PAYMENT_AT_CLINIC') {
    return 'Cash at Clinic';
  }

  if (
    invoice.stripeReceiptUrl ||
    invoice.stripeChargeId ||
    invoice.stripePaymentIntentId ||
    invoice.stripeCheckoutSessionId
  ) {
    return 'Online';
  }

  if (paymentCollectionMethod === 'PAYMENT_LINK' || paymentCollectionMethod === 'PAYMENT_INTENT') {
    return 'Online';
  }

  return '-';
};
