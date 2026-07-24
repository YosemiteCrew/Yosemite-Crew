import {
  derivePaymentLinkStatus,
  findPaymentLinkInvoice,
  type PaymentLinkInvoice,
} from '@/app/features/appointments/lib/paymentLinkStatus';

const invoice = (over: Partial<PaymentLinkInvoice> = {}): PaymentLinkInvoice => ({
  appointmentId: 'appt-1',
  status: 'AWAITING_PAYMENT',
  paymentCollectionMethod: 'PAYMENT_LINK',
  stripeCheckoutUrl: 'https://checkout.stripe.com/c/pay/abc',
  ...over,
});

describe('derivePaymentLinkStatus', () => {
  it('reports a ready link when a checkout URL exists', () => {
    expect(derivePaymentLinkStatus(invoice())).toEqual({
      isSent: false,
      label: 'Stripe · payment link ready',
    });
  });

  it('accepts a payment link id as the link artifact', () => {
    const status = derivePaymentLinkStatus(
      invoice({ stripeCheckoutUrl: undefined, stripePaymentLinkId: 'plink_1' })
    );
    expect(status?.label).toBe('Stripe · payment link ready');
  });

  it('only claims "sent" once the backend stamps a delivery time', () => {
    expect(
      derivePaymentLinkStatus(invoice({ paymentLinkSentAt: '2026-07-19T09:00:00.000Z' }))
    ).toEqual({ isSent: true, label: 'Stripe · payment link sent' });
  });

  it('returns null when there is no invoice at all', () => {
    expect(derivePaymentLinkStatus(undefined)).toBeNull();
  });

  it('returns null when no link artifact exists', () => {
    expect(
      derivePaymentLinkStatus(
        invoice({ stripeCheckoutUrl: undefined, stripePaymentLinkId: undefined })
      )
    ).toBeNull();
  });

  it('returns null when the invoice is not collecting by payment link', () => {
    expect(
      derivePaymentLinkStatus(invoice({ paymentCollectionMethod: 'PAYMENT_AT_CLINIC' }))
    ).toBeNull();
    expect(derivePaymentLinkStatus(invoice({ paymentCollectionMethod: undefined }))).toBeNull();
  });

  it('returns null once the invoice is settled', () => {
    for (const status of ['PAID', 'CANCELLED', 'REFUNDED', 'VOID']) {
      expect(derivePaymentLinkStatus(invoice({ status }))).toBeNull();
    }
  });
});

describe('findPaymentLinkInvoice', () => {
  it('picks the appointment’s open payment-link invoice', () => {
    const match = invoice({ appointmentId: 'appt-2', stripePaymentLinkId: 'plink_2' });
    const found = findPaymentLinkInvoice(
      [
        invoice({ appointmentId: 'other' }),
        invoice({ appointmentId: 'appt-2', status: 'PAID' }),
        match,
      ],
      'appt-2'
    );
    expect(found).toBe(match);
  });

  it('returns undefined when the appointment has no payment-link invoice', () => {
    expect(findPaymentLinkInvoice([invoice({ appointmentId: 'other' })], 'appt-1')).toBeUndefined();
    expect(findPaymentLinkInvoice([], 'appt-1')).toBeUndefined();
  });
});
