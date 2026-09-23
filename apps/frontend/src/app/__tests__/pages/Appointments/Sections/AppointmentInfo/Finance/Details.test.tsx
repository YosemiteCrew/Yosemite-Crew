import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import Details from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Finance/Details';

const useInvoicesMock = jest.fn();

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <>{children}</>,
}));

jest.mock('@/app/ui/overlays/Fallback', () => ({
  __esModule: true,
  default: () => <div>fallback</div>,
}));

jest.mock('@/app/ui/primitives/Accordion/Accordion', () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div>
      <h3>{title}</h3>
      {children}
    </div>
  ),
}));

jest.mock('@/app/hooks/useInvoices', () => ({
  useInvoicesForPrimaryOrgAppointment: (...args: any[]) => useInvoicesMock(...args),
}));

jest.mock('@/app/lib/forms', () => ({
  formatDateLabel: () => 'Jan 01, 2026',
}));

jest.mock('@/app/ui/tables/InvoiceTable', () => ({
  getStatusStyle: () => ({ backgroundColor: 'pink' }),
}));

jest.mock('@/app/lib/validators', () => ({
  // Mirrors the real toTitle's `(str = '')` default so a status-less invoice behaves
  // the same here as in the app instead of throwing.
  toTitle: (value = '') =>
    String(value)
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase()),
}));

jest.mock('@/app/hooks/useBilling', () => ({
  useCurrencyForPrimaryOrg: () => 'USD',
}));

jest.mock('@/app/lib/money', () => ({
  formatMoney: (value: number, currency: string) => `${currency} ${value}`,
  recordCurrency: (record: { currency?: string | null } | null | undefined, fallback: string) =>
    record?.currency ?? fallback,
  formatMoneyPrecise: (amount: number, currency: string) =>
    `${currency} ${Number(amount).toFixed(2)}`,
  sharedCurrency: (records: ReadonlyArray<{ currency?: string | null }>, fallback: string) => {
    let shared: string | null = null;
    for (const record of records) {
      const own = record.currency;
      if (typeof own !== 'string' || !own.trim()) continue;
      if (shared === null) shared = own.trim();
      else if (shared !== own.trim()) return fallback;
    }
    return shared ?? fallback;
  },
}));

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Finance/InvoicePaymentActions',
  () => ({
    __esModule: true,
    default: ({ invoiceId }: any) => <div data-testid={`invoice-actions-${invoiceId}`} />,
  })
);

describe('Finance Details section', () => {
  const activeAppointment: any = { id: 'appt-1' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders invoice details and payment actions', () => {
    useInvoicesMock.mockReturnValue([
      {
        id: 'inv-1',
        appointmentId: 'appt-1',
        createdAt: '2026-01-01T10:00:00Z',
        subtotal: 100,
        discountTotal: 10,
        taxTotal: 5,
        totalAmount: 95,
        status: 'PAID',
        paymentCollectionMethod: 'PAYMENT_AT_CLINIC',
      },
    ]);

    render(<Details activeAppointment={activeAppointment} />);

    expect(screen.getByText('Invoice 1')).toBeInTheDocument();
    expect(screen.getByText('appt-1')).toBeInTheDocument();
    expect(screen.getByText('Jan 01, 2026')).toBeInTheDocument();
    expect(screen.getByText('USD 100')).toBeInTheDocument();
    expect(screen.getByText('USD 95')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('In-person payment')).toBeInTheDocument();
    expect(screen.getByTestId('invoice-actions-inv-1')).toBeInTheDocument();
  });

  it('renders no invoice accordion when appointment has no invoices', () => {
    useInvoicesMock.mockReturnValue([]);
    render(<Details activeAppointment={activeAppointment} />);
    expect(screen.queryByText('Invoice 1')).not.toBeInTheDocument();
  });

  it('shows cash refund disclaimer for cancelled cash-paid appointments', () => {
    useInvoicesMock.mockReturnValue([
      {
        id: 'inv-1',
        appointmentId: 'appt-1',
        createdAt: '2026-01-01T10:00:00Z',
        subtotal: 100,
        discountTotal: 10,
        taxTotal: 5,
        totalAmount: 95,
        status: 'PAID',
        paymentCollectionMethod: 'PAYMENT_AT_CLINIC',
      },
    ]);

    render(<Details activeAppointment={{ id: 'appt-1', status: 'CANCELLED' } as any} />);

    expect(
      screen.getByText(
        'This appointment was paid in cash and is now cancelled. Any refund, if applicable, should be handled directly by the service provider.'
      )
    ).toBeInTheDocument();
  });

  const DISCLAIMER =
    'This appointment was paid in cash and is now cancelled. Any refund, if applicable, should be handled directly by the service provider.';

  const cashInvoice = (overrides: Record<string, unknown> = {}) => ({
    id: 'inv-1',
    appointmentId: 'appt-1',
    createdAt: '2026-01-01T10:00:00Z',
    subtotal: 100,
    discountTotal: 10,
    taxTotal: 5,
    totalAmount: 95,
    status: 'PAID',
    paymentCollectionMethod: 'PAYMENT_AT_CLINIC',
    ...overrides,
  });

  it('shows the disclaimer from the appointment payment status alone, without any invoice', () => {
    useInvoicesMock.mockReturnValue([]);

    render(
      <Details
        activeAppointment={{ id: 'appt-1', status: 'cancelled', paymentStatus: 'paid_cash' } as any}
      />
    );

    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
  });

  it('hides the disclaimer when a cancelled appointment was not collected in cash', () => {
    useInvoicesMock.mockReturnValue([cashInvoice({ paymentCollectionMethod: 'PAYMENT_LINK' })]);

    render(<Details activeAppointment={{ id: 'appt-1', status: 'CANCELLED' } as any} />);

    expect(screen.queryByText(DISCLAIMER)).not.toBeInTheDocument();
  });

  it('shows the disclaimer for an unsettled cash invoice that has already been paid', () => {
    useInvoicesMock.mockReturnValue([
      cashInvoice({ status: 'AWAITING_PAYMENT', paidAt: '2026-01-02T10:00:00Z' }),
    ]);

    render(<Details activeAppointment={{ id: 'appt-1', status: 'CANCELLED' } as any} />);

    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
  });

  it('hides the disclaimer for a cash invoice that is neither settled nor paid', () => {
    useInvoicesMock.mockReturnValue([cashInvoice({ status: 'AWAITING_PAYMENT', paidAt: null })]);

    render(<Details activeAppointment={{ id: 'appt-1', status: 'CANCELLED' } as any} />);

    expect(screen.queryByText(DISCLAIMER)).not.toBeInTheDocument();
  });

  it('falls back to defaults for invoices missing id, appointment id, status, method and totals', () => {
    useInvoicesMock.mockReturnValue([
      // No id -> key falls back to the appointment id.
      {
        appointmentId: 'appt-1',
        createdAt: '2026-01-01T10:00:00Z',
        subtotal: 100,
        totalAmount: 95,
      },
      // No id and no appointment id -> key falls back to the 'appointment' literal.
      {
        createdAt: '2026-01-01T10:00:00Z',
        subtotal: 40,
        totalAmount: 40,
      },
    ]);

    render(<Details activeAppointment={{ id: 'appt-1', status: 'CANCELLED' } as any} />);

    expect(screen.getByText('Invoice 1')).toBeInTheDocument();
    expect(screen.getByText('Invoice 2')).toBeInTheDocument();
    // Missing discount/tax totals render as zero rather than blank.
    expect(screen.getAllByText('USD 0')).toHaveLength(4);
    // A missing collection method has no label to show.
    expect(screen.getAllByText('-')).toHaveLength(2);
    // No cash invoice -> no disclaimer even though the appointment is cancelled.
    expect(screen.queryByText(DISCLAIMER)).not.toBeInTheDocument();
  });
});
