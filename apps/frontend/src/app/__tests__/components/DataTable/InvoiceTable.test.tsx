import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

import InvoiceTable from '@/app/ui/tables/InvoiceTable';
import { getInvoiceStatusStyle } from '@/app/ui/tables/tableUtils';
import { Invoice } from '@yosemite-crew/types';

const useAppointmentsForPrimaryOrgMock = jest.fn();
const pushMock = jest.fn();

jest.mock('@/app/hooks/useAppointments', () => ({
  useAppointmentsForPrimaryOrg: () => useAppointmentsForPrimaryOrgMock(),
}));

jest.mock('@/app/hooks/useBilling', () => ({
  useCurrencyForPrimaryOrg: () => 'USD',
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: any) => <span data-testid="companion-avatar">{alt}</span>,
}));

jest.mock('@/app/ui/tables/GenericTable/GenericTable', () => ({
  __esModule: true,
  default: ({ data, columns }: any) => (
    <div data-testid="generic-table">
      {data.map((item: any, idx: number) => (
        <div key={item.id + idx} data-testid="row">
          {columns.map((col: any) => (
            <div key={col.key} data-testid={`cell-${col.key}`}>
              {col.render ? col.render(item) : item[col.key]}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

jest.mock('@/app/ui/cards/InvoiceCard', () => ({
  __esModule: true,
  default: ({ invoice }: any) => <div data-testid="invoice-card">{invoice.id}</div>,
}));

jest.mock('react-icons/io5', () => ({
  IoEye: () => <span data-testid="eye-icon" />,
  IoOpenOutline: () => <span data-testid="open-icon" />,
}));

jest.mock('@/app/lib/forms', () => ({
  formatDateLabel: () => 'Jan 1',
  formatTimeLabel: () => '10:00 AM',
}));

jest.mock('@/app/lib/invoicePaymentMethod', () => ({
  getInvoicePaymentMethodLabel: () => 'Paid in cash',
}));

expect.extend(toHaveNoViolations);

describe('InvoiceTable', () => {
  const invoice: Invoice = {
    id: 'inv-1',
    companionId: 'comp-1',
    appointmentId: 'Appointment/appt-1',
    createdAt: new Date(),
    subtotal: 10,
    taxTotal: 2,
    totalAmount: 12,
    status: 'PENDING',
    items: [],
    currency: 'AED',
    paymentCollectionMethod: 'PAYMENT_LINK',
    updatedAt: new Date(),
  } as Invoice;

  beforeEach(() => {
    jest.clearAllMocks();
    useAppointmentsForPrimaryOrgMock.mockReturnValue([
      {
        id: 'appt-1',
        appointmentDate: new Date('2025-01-01T10:00:00.000Z'),
        startTime: new Date('2025-01-01T10:00:00.000Z'),
        companion: {
          id: 'comp-1',
          name: 'Buddy',
          parent: { name: 'Sam' },
        },
      },
    ]);
  });

  it('renders columns and handles view action', () => {
    const setActiveInvoice = jest.fn();
    const setViewInvoice = jest.fn();

    render(
      <InvoiceTable
        filteredList={[invoice]}
        setActiveInvoice={setActiveInvoice}
        setViewInvoice={setViewInvoice}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'View invoice inv-1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open finance details for Buddy' }));

    expect(screen.getByText('Sam / Buddy')).toBeInTheDocument();
    expect(screen.getByText('#inv-1')).toBeInTheDocument();
    expect(screen.getByText('Jan 1')).toBeInTheDocument();
    expect(screen.getByText('10:00 AM')).toBeInTheDocument();
    expect(screen.queryByText('Finance')).not.toBeInTheDocument();
    expect(screen.getByText('Paid in cash')).toBeInTheDocument();
    expect(pushMock).toHaveBeenCalledWith(
      '/appointments?appointmentId=appt-1&open=finance&subLabel=summary'
    );
    expect(setActiveInvoice).toHaveBeenCalledWith(invoice);
    expect(setViewInvoice).toHaveBeenCalledWith(true);
  });

  it('shows an accessible empty state when no invoices match', () => {
    render(<InvoiceTable filteredList={[]} />);

    expect(screen.getByRole('status')).toHaveTextContent('No invoices match the current filters.');
  });

  it('has no axe accessibility violations', async () => {
    const { container } = render(<InvoiceTable filteredList={[invoice]} />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('returns styles for known status', () => {
    expect(getInvoiceStatusStyle('pending')).toEqual({
      color: 'var(--color-pill-neutral-text)',
      backgroundColor: 'var(--color-pill-neutral-bg)',
      borderColor: 'var(--color-pill-neutral-border)',
    });
  });

  it('shows only the companion name when the parent name is missing', () => {
    useAppointmentsForPrimaryOrgMock.mockReturnValue([
      {
        id: 'appt-1',
        appointmentDate: new Date('2025-01-01T10:00:00.000Z'),
        startTime: new Date('2025-01-01T10:00:00.000Z'),
        companion: { id: 'comp-1', name: 'Buddy' },
      },
    ]);

    render(<InvoiceTable filteredList={[invoice]} />);

    expect(screen.getByTestId('cell-appointment-id')).toHaveTextContent('Buddy');
    expect(screen.getByTestId('cell-appointment-id')).not.toHaveTextContent('/');
  });

  it('falls back to a dash when neither parent nor companion name is known', () => {
    useAppointmentsForPrimaryOrgMock.mockReturnValue([
      {
        id: 'appt-1',
        appointmentDate: new Date('2025-01-01T10:00:00.000Z'),
        startTime: new Date('2025-01-01T10:00:00.000Z'),
      },
    ]);

    render(<InvoiceTable filteredList={[invoice]} />);

    const cell = screen.getByTestId('cell-appointment-id');
    expect(cell.querySelector('.appointment-profile-title')).toHaveAttribute('title', '-');
  });

  it('shows only the parent name when the companion name is missing', () => {
    useAppointmentsForPrimaryOrgMock.mockReturnValue([
      {
        id: 'appt-1',
        appointmentDate: new Date('2025-01-01T10:00:00.000Z'),
        startTime: new Date('2025-01-01T10:00:00.000Z'),
        companion: { id: 'comp-1', parent: { name: 'Sam' } },
      },
    ]);

    render(<InvoiceTable filteredList={[invoice]} />);

    expect(screen.getByTestId('cell-appointment-id')).toHaveTextContent('Sam');
  });

  it('renders the appointment type in the subtitle and falls back to appointmentDate for the time', () => {
    useAppointmentsForPrimaryOrgMock.mockReturnValue([
      {
        id: 'appt-1',
        appointmentDate: new Date('2025-01-01T10:00:00.000Z'),
        startTime: undefined,
        appointmentType: { name: 'Wellness exam' },
        companion: { id: 'comp-1', name: 'Buddy', parent: { name: 'Sam' } },
      },
    ]);

    render(<InvoiceTable filteredList={[invoice]} />);

    expect(screen.getByTitle('Wellness exam · Jan 1 10:00 AM')).toBeInTheDocument();
  });

  it('renders an empty subtitle and no date cell when the appointment is not found', () => {
    useAppointmentsForPrimaryOrgMock.mockReturnValue([]);

    render(<InvoiceTable filteredList={[invoice]} />);

    expect(
      screen.getByTestId('cell-appointment-id').querySelector('.appointment-profile-sub')
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Open finance details/ })).not.toBeInTheDocument();
  });

  it('falls back to defaults for a bare invoice with no id, number, tax or total', () => {
    const bare = {
      appointmentId: undefined,
      subtotal: 5,
      discountTotal: 1,
      items: [],
      status: 'PENDING',
    } as unknown as Invoice;

    render(<InvoiceTable filteredList={[bare]} />);

    expect(screen.getByTestId('cell-invoice-number')).toHaveTextContent('-');
    expect(screen.getByRole('button', { name: 'View invoice' })).toBeInTheDocument();
    expect(screen.getByTestId('invoice-card')).toBeInTheDocument();
  });
});
