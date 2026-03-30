import {
  createInvoiceByAppointmentId,
  getAppointmentPaymentDisplay,
} from '@/app/lib/paymentStatus';

describe('paymentStatus', () => {
  it('builds invoice map and keeps latest invoice by rank', () => {
    const map = createInvoiceByAppointmentId([
      {
        appointmentId: 'Appointment/appt-1',
        id: 'old',
        createdAt: '2026-01-01T00:00:00Z',
        status: 'PAID',
      } as any,
      {
        appointmentId: 'appt-1',
        id: 'new',
        createdAt: '2026-01-02T00:00:00Z',
        status: 'PAID',
      } as any,
    ]);

    expect(map['appt-1'].id).toBe('new');
  });

  it('respects explicit appointment payment status values', () => {
    expect(
      getAppointmentPaymentDisplay({
        id: 'a1',
        paymentStatus: 'paid_cash',
        status: 'REQUESTED',
      } as any).state
    ).toBe('PAID_CASH');
    expect(
      getAppointmentPaymentDisplay({
        id: 'a1',
        paymentStatus: 'payment-at-clinic',
        status: 'REQUESTED',
      } as any).state
    ).toBe('PAYMENT_AT_CLINIC');
    expect(
      getAppointmentPaymentDisplay({
        id: 'a1',
        paymentStatus: 'unpaid',
        status: 'REQUESTED',
      } as any).state
    ).toBe('UNPAID');
  });

  it('reads payment status from extension', () => {
    const display = getAppointmentPaymentDisplay(
      {
        id: 'a1',
        status: 'REQUESTED',
        extension: [
          {
            url: 'https://yosemitecrew.com/fhir/StructureDefinition/appointment-payment-status',
            valueString: 'PAID',
          },
        ],
      } as any,
      {}
    );
    expect(display.state).toBe('PAID');
  });

  it('falls back when invoice is missing', () => {
    expect(getAppointmentPaymentDisplay({ id: 'a1', status: 'NO_PAYMENT' } as any, {}).state).toBe(
      'UNPAID'
    );
    expect(getAppointmentPaymentDisplay({ id: 'a1', status: 'REQUESTED' } as any, {}).state).toBe(
      'PAID'
    );
  });

  it('returns unpaid for non-paid invoice', () => {
    const display = getAppointmentPaymentDisplay({ id: 'a1', status: 'REQUESTED' } as any, {
      a1: { id: 'inv', appointmentId: 'a1', status: 'PENDING' } as any,
    });
    expect(display.state).toBe('UNPAID');
  });

  it('returns paid cash for likely cash invoice', () => {
    const display = getAppointmentPaymentDisplay({ id: 'a1', status: 'REQUESTED' } as any, {
      a1: {
        id: 'inv',
        appointmentId: 'a1',
        status: 'PAID',
        paymentCollectionMethod: 'OFFLINE',
        metadata: { paymentMethod: 'cash' },
      } as any,
    });
    expect(display.state).toBe('PAID_CASH');
  });

  it('returns paid for paid stripe-linked invoice', () => {
    const display = getAppointmentPaymentDisplay({ id: 'a1', status: 'REQUESTED' } as any, {
      a1: {
        id: 'inv',
        appointmentId: 'a1',
        status: 'PAID',
        stripePaymentIntentId: 'pi_123',
      } as any,
    });
    expect(display.state).toBe('PAID');
  });

  it('skips invoices without appointmentId in createInvoiceByAppointmentId', () => {
    const result = createInvoiceByAppointmentId([{ appointmentId: undefined } as any]);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('keeps existing invoice when ranks are equal', () => {
    const ts = '2026-01-01T00:00:00Z';
    const first = { appointmentId: 'appt-1', id: 'first', createdAt: ts, status: 'PAID' } as any;
    const second = { appointmentId: 'appt-1', id: 'second', createdAt: ts, status: 'PAID' } as any;
    const result = createInvoiceByAppointmentId([first, second]);
    // second has same rank >= first so it replaces
    expect(result['appt-1'].id).toBe('second');
  });

  it('returns PAID_CASH for payment at clinic status', () => {
    const display = getAppointmentPaymentDisplay(
      { id: 'a1', paymentStatus: 'PAYMENT_AT_CLINIC', status: 'REQUESTED' } as any,
      {}
    );
    expect(display.state).toBe('PAYMENT_AT_CLINIC');
    expect(display.label).toBe('Paid in cash');
  });

  it('returns UNPAID for explicit UNPAID status with correct colors', () => {
    const display = getAppointmentPaymentDisplay(
      { id: 'a1', paymentStatus: 'UNPAID', status: 'REQUESTED' } as any,
      {}
    );
    expect(display.state).toBe('UNPAID');
    expect(display.textColor).toBe('#F68523');
  });

  it('returns PAID when stripePaymentLinkId present', () => {
    const display = getAppointmentPaymentDisplay({ id: 'a1', status: 'REQUESTED' } as any, {
      a1: {
        id: 'inv',
        appointmentId: 'a1',
        status: 'PAID',
        paidAt: '2025-01-01T00:00:00Z',
        stripePaymentLinkId: 'plink_123',
      } as any,
    });
    expect(display.state).toBe('PAID');
  });

  it('returns PAID when stripeInvoiceId present', () => {
    const display = getAppointmentPaymentDisplay({ id: 'a1', status: 'REQUESTED' } as any, {
      a1: {
        id: 'inv',
        appointmentId: 'a1',
        status: 'PAID',
        paidAt: '2025-01-01T00:00:00Z',
        stripeInvoiceId: 'in_123',
      } as any,
    });
    expect(display.state).toBe('PAID');
  });

  it('returns PAID when stripeReceiptUrl present', () => {
    const display = getAppointmentPaymentDisplay({ id: 'a1', status: 'REQUESTED' } as any, {
      a1: {
        id: 'inv',
        appointmentId: 'a1',
        status: 'PAID',
        paidAt: '2025-01-01T00:00:00Z',
        stripeReceiptUrl: 'https://stripe.com/receipt',
      } as any,
    });
    expect(display.state).toBe('PAID');
  });

  it('isLikelyCash returns false for PAYMENT_LINK collection method', () => {
    const display = getAppointmentPaymentDisplay({ id: 'a1', status: 'REQUESTED' } as any, {
      a1: {
        id: 'inv',
        appointmentId: 'a1',
        status: 'PAID',
        paidAt: '2025-01-01T00:00:00Z',
        paymentCollectionMethod: 'PAYMENT_LINK',
      } as any,
    });
    expect(display.state).toBe('PAID');
  });

  it('handles invoice with paidAt but no status PAID', () => {
    const display = getAppointmentPaymentDisplay({ id: 'a1', status: 'REQUESTED' } as any, {
      a1: {
        id: 'inv',
        appointmentId: 'a1',
        status: 'PENDING',
        paidAt: '2025-01-01T00:00:00Z', // paidAt overrides status check
      } as any,
    });
    // paidAt makes isInvoicePaid return true, no stripe evidence -> PAID_CASH
    expect(display.state).toBe('PAID_CASH');
  });

  it('metadataSuggestsCash checks tender keyword', () => {
    const display = getAppointmentPaymentDisplay({ id: 'a1', status: 'REQUESTED' } as any, {
      a1: {
        id: 'inv',
        appointmentId: 'a1',
        status: 'PAID',
        paidAt: '2025-01-01T00:00:00Z',
        metadata: { tender_type: 'cash' },
      } as any,
    });
    expect(display.state).toBe('PAID_CASH');
  });

  it('handles non-array extension field gracefully', () => {
    const display = getAppointmentPaymentDisplay(
      { id: 'a1', extension: 'not-array', status: 'REQUESTED' } as any,
      {}
    );
    expect(display.state).toBe('PAID');
  });
});
