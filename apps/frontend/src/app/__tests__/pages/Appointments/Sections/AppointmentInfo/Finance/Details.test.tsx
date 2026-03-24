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
  toTitle: (value: string) => value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
}));

jest.mock('@/app/hooks/useBilling', () => ({
  useCurrencyForPrimaryOrg: () => 'USD',
}));

jest.mock('@/app/lib/money', () => ({
  formatMoney: (value: number, currency: string) => `${currency} ${value}`,
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
      },
    ]);

    render(<Details activeAppointment={activeAppointment} />);

    expect(screen.getByText('Invoice 1')).toBeInTheDocument();
    expect(screen.getByText('appt-1')).toBeInTheDocument();
    expect(screen.getByText('Jan 01, 2026')).toBeInTheDocument();
    expect(screen.getByText('USD 100')).toBeInTheDocument();
    expect(screen.getByText('USD 95')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
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
});
