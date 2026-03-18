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
});
