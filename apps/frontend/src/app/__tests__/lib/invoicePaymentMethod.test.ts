import {
  getPaymentCollectionMethodLabel,
  getInvoicePaymentMethodLabel,
} from '@/app/lib/invoicePaymentMethod';
import { Invoice } from '@yosemite-crew/types';

describe('getPaymentCollectionMethodLabel', () => {
  it('returns "In-person payment" for PAYMENT_AT_CLINIC', () => {
    expect(getPaymentCollectionMethodLabel('PAYMENT_AT_CLINIC')).toBe('In-person payment');
  });

  it('returns "Online payment" for PAYMENT_LINK', () => {
    expect(getPaymentCollectionMethodLabel('PAYMENT_LINK')).toBe('Online payment');
  });

  it('returns "Online payment" for PAYMENT_INTENT', () => {
    expect(getPaymentCollectionMethodLabel('PAYMENT_INTENT')).toBe('Online payment');
  });

  it('normalizes lowercase input with spaces', () => {
    expect(getPaymentCollectionMethodLabel('payment at clinic')).toBe('In-person payment');
  });

  it('normalizes dash-separated input', () => {
    expect(getPaymentCollectionMethodLabel('payment-link')).toBe('Online payment');
  });

  it('returns friendly text for unknown methods', () => {
    expect(getPaymentCollectionMethodLabel('CASH_ON_DELIVERY')).toBe('Cash On Delivery');
  });

  it('returns dash for null', () => {
    expect(getPaymentCollectionMethodLabel(null)).toBe('-');
  });

  it('returns dash for empty string', () => {
    expect(getPaymentCollectionMethodLabel('')).toBe('-');
  });

  it('returns dash for undefined', () => {
    expect(getPaymentCollectionMethodLabel(undefined)).toBe('-');
  });
});

describe('getInvoicePaymentMethodLabel', () => {
  it('returns dash for null invoice', () => {
    expect(getInvoicePaymentMethodLabel(null)).toBe('-');
  });

  it('returns dash for undefined invoice', () => {
    expect(getInvoicePaymentMethodLabel(undefined)).toBe('-');
  });

  it('uses paymentCollectionMethod if present', () => {
    const invoice = { paymentCollectionMethod: 'PAYMENT_AT_CLINIC' } as any;
    expect(getInvoicePaymentMethodLabel(invoice)).toBe('In-person payment');
  });

  it('falls back to "Online payment" when stripeReceiptUrl is present', () => {
    const invoice = { stripeReceiptUrl: 'https://stripe.com/receipt/123' } as Invoice;
    expect(getInvoicePaymentMethodLabel(invoice)).toBe('Online payment');
  });

  it('falls back to "Online payment" when stripeChargeId is present', () => {
    const invoice = { stripeChargeId: 'ch_123' } as Invoice;
    expect(getInvoicePaymentMethodLabel(invoice)).toBe('Online payment');
  });

  it('falls back to "Online payment" when stripePaymentIntentId is present', () => {
    const invoice = { stripePaymentIntentId: 'pi_123' } as Invoice;
    expect(getInvoicePaymentMethodLabel(invoice)).toBe('Online payment');
  });

  it('falls back to "Online payment" when stripeCheckoutSessionId is present', () => {
    const invoice = { stripeCheckoutSessionId: 'cs_123' } as Invoice;
    expect(getInvoicePaymentMethodLabel(invoice)).toBe('Online payment');
  });

  it('returns dash when no payment method info is present', () => {
    const invoice = {} as Invoice;
    expect(getInvoicePaymentMethodLabel(invoice)).toBe('-');
  });
});
