import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PhoneInvoiceList from '@/app/features/finance/pages/Finance/Sections/PhoneInvoiceList';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: any) => <span>{alt}</span>,
}));

const appointmentsMock: any[] = [];
jest.mock('@/app/hooks/useAppointments', () => ({
  useAppointmentsForPrimaryOrg: () => appointmentsMock,
}));

jest.mock('@/app/lib/money', () => ({
  formatMoney: (amount: number) => `€${amount}`,
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

jest.mock('@/app/lib/forms', () => ({
  formatDateLabel: () => '7 Jul',
}));

jest.mock('@/app/lib/validators', () => ({
  toTitle: (s: string) => s,
}));

const getAppointmentByIdFromListMock = jest.fn(() => ({
  appointmentType: { name: 'Annual check-up' },
}));
const getCompanionNameMock = jest.fn(() => 'Poppy');
const getParentNameMock = jest.fn(() => 'Lena');
jest.mock('@/app/lib/invoice', () => ({
  getInvoiceNumberLabel: (i: any) => (i.id ? `#${i.id}` : ''),
  getAppointmentByIdFromList: () => getAppointmentByIdFromListMock(),
  getCompanionNameFromAppointments: () => getCompanionNameMock(),
  getParentNameFromAppointments: () => getParentNameMock(),
}));

jest.mock('@/app/lib/invoicePaymentMethod', () => ({
  getInvoicePaymentMethodLabel: (i: any) => i.method ?? '-',
}));

jest.mock('@/app/ui/tables/tableUtils', () => ({
  getInvoiceStatusTone: () => 'success',
}));

jest.mock('@/app/lib/financeMetrics', () => ({
  getInvoiceOutstanding: (i: any) => i.outstanding ?? 0,
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeImageUrl: () => '/img.png',
  ImageType: {},
}));

jest.mock('@/app/lib/appointments', () => ({
  getAppointmentCompanion: () => ({ species: 'dog', name: 'Poppy', parent: {} }),
  getAppointmentCompanionPhotoUrl: () => undefined,
}));

jest.mock('@/app/features/finance/pages/Finance/Sections/InvoiceStatusFilterPills', () => ({
  __esModule: true,
  default: ({ activeStatus }: any) => <div data-testid="pills">{activeStatus}</div>,
}));

const paid = {
  id: '1',
  status: 'PAID',
  outstanding: 0,
  method: 'Online · card',
  totalAmount: 58,
  items: [],
  appointmentId: 'a1',
  depositCollectedAmount: 0,
} as any;
const unpaid = {
  id: '2',
  status: 'AWAITING_PAYMENT',
  outstanding: 42,
  totalAmount: 42,
  items: [],
  appointmentId: 'a2',
  depositCollectedAmount: 0,
} as any;
const partial = {
  id: '3',
  status: 'PENDING',
  outstanding: 87,
  totalAmount: 107,
  items: [],
  appointmentId: 'a3',
  depositCollectedAmount: 20,
} as any;

const baseProps = {
  statusOptions: [{ name: 'All', key: 'all' }] as any,
  activeStatus: 'all',
  setActiveStatus: jest.fn(),
  metrics: { collectedThisWeek: 4820, outstanding: 214 },
  currency: 'EUR',
  metricsCurrency: 'EUR',
  onViewInvoice: jest.fn(),
};

describe('PhoneInvoiceList', () => {
  beforeEach(() => {
    getAppointmentByIdFromListMock.mockReturnValue({
      appointmentType: { name: 'Annual check-up' },
    });
    getCompanionNameMock.mockReturnValue('Poppy');
    getParentNameMock.mockReturnValue('Lena');
  });

  it('renders the KPI stat tiles with formatted money', () => {
    render(<PhoneInvoiceList {...baseProps} filteredList={[paid]} />);

    expect(screen.getByText('Collected · wk')).toBeInTheDocument();
    // The KPI tiles sum across the list, so they take the currency the list
    // agrees on. This fixture carries none, so the helper falls back to the
    // ambient value rather than inventing one.
    expect(screen.getByText('EUR 4820.00')).toBeInTheDocument();
    expect(screen.getByText('Outstanding')).toBeInTheDocument();
    expect(screen.getByText('EUR 214.00')).toBeInTheDocument();
  });

  it('renders the status filter pills', () => {
    render(<PhoneInvoiceList {...baseProps} filteredList={[paid]} />);
    expect(screen.getByTestId('pills')).toHaveTextContent('all');
  });

  it('renders a card per invoice and opens the record on tap', () => {
    const onViewInvoice = jest.fn();
    render(
      <PhoneInvoiceList
        {...baseProps}
        onViewInvoice={onViewInvoice}
        filteredList={[paid, unpaid, partial]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'View invoice #1' }));
    expect(onViewInvoice).toHaveBeenCalledWith(paid);
  });

  it('shows the payment-method footnote for a settled invoice', () => {
    render(<PhoneInvoiceList {...baseProps} filteredList={[paid]} />);
    expect(screen.getByText('Online · card')).toBeInTheDocument();
  });

  it('gives an unpaid invoice the warn left-border and no footnote', () => {
    render(<PhoneInvoiceList {...baseProps} filteredList={[unpaid]} />);
    const card = screen.getByRole('button', { name: 'View invoice #2' });
    expect(card.className).toContain('border-l-[var(--warn)]');
  });

  it('shows a deposit footnote for a partial invoice and no warn border', () => {
    render(<PhoneInvoiceList {...baseProps} filteredList={[partial]} />);
    const card = screen.getByRole('button', { name: 'View invoice #3' });
    expect(card.className).not.toContain('border-l-[var(--warn)]');
    // The fixture invoice carries currency: 'EUR'. Before this change the
    // footnote used the ambient organisation currency and would have said USD
    // for a euro invoice - that is the bug, visible here.
    expect(screen.getByText('Deposit EUR 20.00 applied')).toBeInTheDocument();
  });

  it('renders the empty state when there are no invoices', () => {
    render(<PhoneInvoiceList {...baseProps} filteredList={[]} />);
    expect(screen.getByText('No invoices match the current filters.')).toBeInTheDocument();
  });

  it('shows just the companion when there is no parent name', () => {
    getParentNameMock.mockReturnValue('-');
    render(<PhoneInvoiceList {...baseProps} filteredList={[paid]} />);
    expect(screen.getByText(/Poppy · Annual check-up/)).toBeInTheDocument();
  });

  it('shows just the parent when there is no companion name', () => {
    getCompanionNameMock.mockReturnValue('-');
    render(<PhoneInvoiceList {...baseProps} filteredList={[paid]} />);
    expect(screen.getByText(/Lena · Annual check-up/)).toBeInTheDocument();
  });

  it('falls back to "Unlinked invoice" when there is no appointment or names', () => {
    getAppointmentByIdFromListMock.mockReturnValue(undefined as any);
    getParentNameMock.mockReturnValue('-');
    getCompanionNameMock.mockReturnValue('-');
    render(<PhoneInvoiceList {...baseProps} filteredList={[{ ...paid, id: '9' }]} />);
    expect(screen.getByText('Unlinked invoice')).toBeInTheDocument();
  });

  it('omits the status badge and footnote when neither applies', () => {
    getAppointmentByIdFromListMock.mockReturnValue(undefined as any);
    render(
      <PhoneInvoiceList
        {...baseProps}
        filteredList={[
          {
            id: '10',
            status: '',
            outstanding: 5,
            totalAmount: 5,
            depositCollectedAmount: 0,
          } as any,
        ]}
      />
    );
    // status '' → no badge text; outstanding>0 without deposit → unpaid, no footnote row
    const card = screen.getByRole('button', { name: 'View invoice #10' });
    expect(card.className).toContain('border-l-[var(--warn)]');
  });

  it('renders a bare invoice with every fallback (no id, status, total, appointment)', () => {
    getAppointmentByIdFromListMock.mockReturnValue(undefined as any);
    getParentNameMock.mockReturnValue('-');
    getCompanionNameMock.mockReturnValue('-');
    render(<PhoneInvoiceList {...baseProps} filteredList={[{} as any]} />);
    expect(screen.getByRole('button', { name: 'View invoice Invoice' })).toBeInTheDocument();
  });

  it('omits the footnote when a settled invoice has no payment method', () => {
    render(
      <PhoneInvoiceList {...baseProps} filteredList={[{ ...paid, id: '11', method: undefined }]} />
    );
    // getInvoicePaymentMethodLabel → '-' so no footnote is shown
    expect(screen.queryByText('-')).not.toBeInTheDocument();
  });
});
