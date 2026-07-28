import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

import InvoiceTable from '@/app/ui/tables/InvoiceTable';
import { getInvoiceStatusStyle, getInvoiceStatusTone } from '@/app/ui/tables/tableUtils';
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

const mockGenericTableCalls: { columns: any[]; tableClassName?: string }[] = [];

const isDesktopVariant = (tableClassName?: string) =>
  String(tableClassName ?? '').includes('invoice-table-fixed');

const capturedColumnWidths = () => {
  const widthOf = (columns: any[], key: string) => columns.find((c) => c.key === key)?.width;
  const columnsFor = (desktop: boolean) =>
    mockGenericTableCalls.find((c) => isDesktopVariant(c.tableClassName) === desktop)!.columns;
  return {
    desktop: { status: widthOf(columnsFor(true), 'status') },
    tablet: {
      status: widthOf(columnsFor(false), 'status'),
      parent: widthOf(columnsFor(false), 'appointment-id'),
    },
  };
};

// InvoiceTable renders two GenericTables — the 11-column desktop set and the
// 6-column tablet set — and hides one with CSS. jsdom applies no CSS, so both
// are always in the tree; the mock namespaces the tablet one so queries can
// target a single variant.
jest.mock('@/app/ui/tables/GenericTable/GenericTable', () => ({
  __esModule: true,
  default: ({ data, columns, tableClassName }: any) => {
    mockGenericTableCalls.push({ columns, tableClassName });
    const prefix = String(tableClassName ?? '').includes('invoice-table-fixed') ? '' : 'tablet-';
    return (
      <div data-testid={`${prefix}generic-table`}>
        {data.map((item: any, idx: number) => (
          <div key={item.id + idx} data-testid={`${prefix}row`}>
            {columns.map((col: any) => (
              <div key={col.key} data-testid={`${prefix}cell-${col.key}`}>
                {col.render ? col.render(item) : item[col.key]}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  },
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
    mockGenericTableCalls.length = 0;
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

    const desktop = within(screen.getByTestId('generic-table'));
    fireEvent.click(desktop.getByRole('button', { name: 'View invoice inv-1' }));
    fireEvent.click(desktop.getByRole('button', { name: 'Open finance details for Buddy' }));

    expect(desktop.getByText('Sam / Buddy')).toBeInTheDocument();
    expect(desktop.getByText('#inv-1')).toBeInTheDocument();
    // Design's date cell is one muted line — the time rides the identity
    // sub-line, so it is not repeated here.
    const dateCell = desktop.getByRole('button', { name: 'Open finance details for Buddy' });
    expect(dateCell).toHaveTextContent('Jan 1');
    expect(dateCell).not.toHaveTextContent('10:00 AM');
    expect(screen.queryByText('Finance')).not.toBeInTheDocument();
    expect(desktop.getByText('Paid in cash')).toBeInTheDocument();
    const status = desktop.getByText('Pending');
    expect(status).toHaveClass('rounded-full!', 'text-[10px]', 'font-bold', 'uppercase');
    expect(status).toHaveAttribute(
      'style',
      expect.stringContaining('background-color: var(--color-pill-neutral-bg)')
    );
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

  it('returns tones for known status', () => {
    expect(getInvoiceStatusTone('paid')).toBe('success');
    expect(getInvoiceStatusTone('awaiting_payment')).toBe('info');
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

  it('shows the appointment time (not the type) in the desktop Parent / patient sub-line, since Services already shows the type', () => {
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

    // Two appointments for the same patient on the same date are otherwise
    // indistinguishable in this table without opening each row, since the
    // Date column shows only the date - the time must survive here.
    const cell = within(screen.getByTestId('cell-appointment-id'));
    expect(cell.getByTitle('10:00 AM')).toBeInTheDocument();
    expect(cell.queryByText(/Wellness exam/)).not.toBeInTheDocument();
  });

  it('renders an empty subtitle and no date cell when the appointment is not found', () => {
    useAppointmentsForPrimaryOrgMock.mockReturnValue([]);

    render(<InvoiceTable filteredList={[invoice]} />);

    expect(
      screen.getByTestId('cell-appointment-id').querySelector('.appointment-profile-sub')
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Open finance details/ })).not.toBeInTheDocument();
  });

  describe('tablet column set (768-1279)', () => {
    it('prunes to six columns and folds the dropped meta into the sub-lines', () => {
      useAppointmentsForPrimaryOrgMock.mockReturnValue([
        {
          id: 'appt-1',
          appointmentDate: new Date('2025-01-01T10:00:00.000Z'),
          startTime: new Date('2025-01-01T10:00:00.000Z'),
          appointmentType: { name: 'Wellness exam' },
          companion: { id: 'comp-1', name: 'Buddy', parent: { name: 'Sam' } },
        },
      ]);

      render(
        <InvoiceTable
          filteredList={[{ ...invoice, items: [{ name: 'Dental cleaning' }] } as Invoice]}
        />
      );

      const tablet = within(screen.getByTestId('tablet-generic-table'));
      const row = within(screen.getByTestId('tablet-row'));

      // <= 6 columns, per the design's tablet adaptation rule
      expect(screen.getByTestId('tablet-row').children).toHaveLength(6);

      // Services + Date are gone as columns...
      expect(screen.queryByTestId('tablet-cell-service')).not.toBeInTheDocument();
      expect(screen.queryByTestId('tablet-cell-date')).not.toBeInTheDocument();
      // ...and fold into the Parent / patient sub-line instead
      expect(
        row.getByTitle('Wellness exam · Jan 1 10:00 AM · Dental cleaning')
      ).toBeInTheDocument();

      // Subtotal / Discount / Tax are gone as columns...
      expect(screen.queryByTestId('tablet-cell-sub-total')).not.toBeInTheDocument();
      expect(screen.queryByTestId('tablet-cell-discount')).not.toBeInTheDocument();
      expect(screen.queryByTestId('tablet-cell-tax')).not.toBeInTheDocument();
      // ...and fold under Total
      expect(screen.getByTestId('tablet-cell-total')).toHaveTextContent(/Sub .*Disc .*Tax/);

      // the six that survive
      expect(screen.getByTestId('tablet-cell-invoice-number')).toBeInTheDocument();
      expect(screen.getByTestId('tablet-cell-appointment-id')).toBeInTheDocument();
      expect(screen.getByTestId('tablet-cell-status')).toBeInTheDocument();
      expect(screen.getByTestId('tablet-cell-payment')).toBeInTheDocument();
      expect(tablet.getByRole('button', { name: 'View invoice inv-1' })).toBeInTheDocument();
    });

    it('gives Status a column wide enough for the widest badge', () => {
      render(<InvoiceTable filteredList={[invoice]} />);

      // "AWAITING PAYMENT" measures 133.7px + 22px td padding = ~156px bare
      // minimum, which real-world font hinting/zoom/DPI variance clipped in
      // production ("AWAITING PAYME"). 176px keeps a real ~20px margin instead
      // of a ~4px one.
      const widths = capturedColumnWidths();
      expect(Number.parseInt(widths.desktop.status, 10)).toBeGreaterThanOrEqual(176);
      expect(Number.parseInt(widths.tablet.status, 10)).toBeGreaterThanOrEqual(176);
    });

    it('leaves the Parent / patient column fluid so it absorbs the slack', () => {
      render(<InvoiceTable filteredList={[invoice]} />);

      expect(capturedColumnWidths().tablet.parent).toBeUndefined();
    });
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
    expect(screen.getByTestId('tablet-cell-invoice-number')).toHaveTextContent('-');
    expect(
      within(screen.getByTestId('generic-table')).getByRole('button', { name: 'View invoice' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('invoice-card')).toBeInTheDocument();
  });
});
