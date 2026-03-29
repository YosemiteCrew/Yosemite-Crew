import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import Summary from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Finance/Summary';

const useInvoicesMock = jest.fn();

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: any) => <span data-testid="mock-next-image">{alt}</span>,
}));

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <>{children}</>,
}));

jest.mock('@/app/ui/overlays/Fallback', () => ({
  __esModule: true,
  default: () => <div>fallback</div>,
}));

jest.mock('@/app/ui/primitives/Accordion/EditableAccordion', () => ({
  __esModule: true,
  default: ({ title, data }: any) => (
    <div data-testid="editable-accordion">
      <h3>{title}</h3>
      <span>{data?.service}</span>
    </div>
  ),
}));

jest.mock('@/app/hooks/useBilling', () => ({
  useCurrencyForPrimaryOrg: () => 'USD',
}));

jest.mock('@/app/hooks/useInvoices', () => ({
  useInvoicesForPrimaryOrgAppointment: (...args: any[]) => useInvoicesMock(...args),
}));

jest.mock('@/app/lib/money', () => ({
  formatMoney: (value: number, currency: string) => `${currency} ${value}`,
}));

jest.mock('@/app/lib/validators', () => ({
  toNumberSafe: (value: any) => Number(value || 0),
}));

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Finance/InvoicePaymentActions',
  () => ({
    __esModule: true,
    default: ({ invoiceId }: any) => <div data-testid={`pay-actions-${invoiceId || 'none'}`} />,
  })
);

jest.mock('@/app/constants/mediaSources', () => ({
  MEDIA_SOURCES: {
    appointments: { stripe: '/stripe.png' },
  },
}));

describe('Finance Summary section', () => {
  const activeAppointment: any = {
    id: 'appt-1',
    concern: 'Cough',
    appointmentType: { name: 'Consultation' },
    appointmentDate: '2026-01-01',
    startTime: '10:00',
    lead: { name: 'Dr. A' },
    status: 'REQUESTED',
  };

  const formData: any = {
    subTotal: 10,
    discount: 1,
    tax: 1,
    total: 10,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses payable invoice totals when pending invoice exists', () => {
    useInvoicesMock.mockReturnValue([
      {
        id: 'inv-paid',
        status: 'PAID',
        createdAt: '2026-01-02T00:00:00Z',
        subtotal: 120,
        discountTotal: 10,
        taxTotal: 5,
        totalAmount: 115,
      },
      {
        id: 'inv-pending',
        status: 'PENDING',
        createdAt: '2026-01-03T00:00:00Z',
        subtotal: 80,
        discountTotal: 5,
        taxTotal: 3,
        totalAmount: 78,
      },
    ]);

    render(<Summary activeAppointment={activeAppointment} formData={formData} />);

    expect(screen.getByTestId('editable-accordion')).toBeInTheDocument();
    expect(screen.getByText('Consultation')).toBeInTheDocument();
    expect(screen.getByText('USD 80')).toBeInTheDocument();
    expect(screen.getByText('USD 78')).toBeInTheDocument();
    expect(screen.getByTestId('pay-actions-inv-pending')).toBeInTheDocument();
  });

  it('falls back to form totals when no invoice exists', () => {
    useInvoicesMock.mockReturnValue([]);
    render(<Summary activeAppointment={activeAppointment} formData={formData} />);

    expect(screen.getAllByText('USD 10').length).toBeGreaterThan(0);
    expect(screen.getAllByText('USD 1').length).toBeGreaterThan(0);
    expect(screen.getByTestId('pay-actions-none')).toBeInTheDocument();
  });

  it('shows cash refund disclaimer for cancelled cash-paid appointments', () => {
    useInvoicesMock.mockReturnValue([
      {
        id: 'inv-cash',
        status: 'PAID',
        paymentCollectionMethod: 'PAYMENT_AT_CLINIC',
        createdAt: '2026-01-03T00:00:00Z',
        subtotal: 80,
        discountTotal: 5,
        taxTotal: 3,
        totalAmount: 78,
      },
    ]);

    render(
      <Summary
        activeAppointment={{ ...activeAppointment, status: 'CANCELLED' }}
        formData={formData}
      />
    );

    expect(
      screen.getByText(
        'This appointment was paid in cash and is now cancelled. Any refund, if applicable, should be handled directly by the service provider.'
      )
    ).toBeInTheDocument();
  });
});
