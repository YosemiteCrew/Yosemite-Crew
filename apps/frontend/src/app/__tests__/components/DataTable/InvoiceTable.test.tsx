import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import InvoiceTable, { getStatusStyle } from '@/app/ui/tables/InvoiceTable';
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

    fireEvent.click(screen.getByTestId('eye-icon').closest('button')!);
    fireEvent.click(screen.getByTitle('Open appointment finance'));

    expect(screen.getByText('Sam / Buddy')).toBeInTheDocument();
    expect(pushMock).toHaveBeenCalledWith(
      '/appointments?appointmentId=appt-1&open=finance&subLabel=summary'
    );
    expect(setActiveInvoice).toHaveBeenCalledWith(invoice);
    expect(setViewInvoice).toHaveBeenCalledWith(true);
  });

  it('returns styles for known status', () => {
    expect(getStatusStyle('pending')).toEqual({
      color: '#fff',
      backgroundColor: '#747283',
    });
  });
});
