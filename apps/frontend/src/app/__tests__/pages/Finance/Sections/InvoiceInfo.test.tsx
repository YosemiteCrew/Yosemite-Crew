import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import InvoiceInfo from '@/app/features/finance/pages/Finance/Sections/InvoiceInfo';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockIsPhone = jest.fn(() => false);
jest.mock('@/app/ui/layout/PhoneShell/useIsPhone', () => ({
  __esModule: true,
  default: () => mockIsPhone(),
}));

const mockGetParentById = jest.fn(() => null as any);
jest.mock('@/app/stores/parentStore', () => ({
  useParentStore: (selector: any) => selector({ getParentById: mockGetParentById }),
}));

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock('@/app/features/finance/pages/Finance/Sections/InvoiceDetailHeader', () => ({
  __esModule: true,
  default: ({ titleId, invoice, statusLabel, onClose, onOpenAppointment }: any) => (
    <div data-testid="invoice-header">
      <h2 id={titleId}>{invoice?.id}</h2>
      <span>{statusLabel}</span>
      <button type="button" onClick={onClose}>
        close
      </button>
      {onOpenAppointment && (
        <button type="button" onClick={onOpenAppointment}>
          open-appointment
        </button>
      )}
    </div>
  ),
}));

jest.mock('@/app/features/finance/pages/Finance/Sections/InvoicePhoneRecord', () => ({
  __esModule: true,
  default: ({ titleId, invoice, onClose, onOpenAppointment }: any) => (
    <div data-testid="phone-record">
      <h2 id={titleId}>{invoice?.id}</h2>
      <button type="button" onClick={onClose}>
        phone-close
      </button>
      {onOpenAppointment && (
        <button type="button" onClick={onOpenAppointment}>
          phone-open-appointment
        </button>
      )}
    </div>
  ),
}));

jest.mock('@/app/features/finance/pages/Finance/Sections/InvoiceBilledItems', () => ({
  __esModule: true,
  default: () => <div data-testid="billed-items" />,
}));

jest.mock('@/app/features/finance/pages/Finance/Sections/InvoiceSummaryPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="summary-panel" />,
}));

jest.mock('@/app/features/finance/pages/Finance/Sections/InvoiceBilledTo', () => ({
  __esModule: true,
  default: () => <div data-testid="billed-to" />,
}));

jest.mock('@/app/features/finance/pages/Finance/Sections/InvoicePaymentLedger', () => ({
  __esModule: true,
  default: ({ payerName, payerEmail }: any) => (
    <div data-testid="payment-ledger">
      <span data-testid="ledger-payer-name">{payerName}</span>
      <span data-testid="ledger-payer-email">{payerEmail}</span>
    </div>
  ),
}));

jest.mock('@/app/ui/tables/tableUtils', () => ({
  getInvoiceStatusTone: () => 'success',
}));

jest.mock('@/app/hooks/useAppointments', () => ({
  useAppointmentsForPrimaryOrg: () => [],
}));

jest.mock('@/app/hooks/useBilling', () => ({
  useCurrencyForPrimaryOrg: () => 'USD',
}));

jest.mock('@/app/lib/invoice', () => ({
  getAppointmentByIdFromList: jest.fn(() => undefined),
}));

jest.mock('@/app/lib/appointments', () => ({
  getAppointmentCompanion: () => ({
    name: 'Poppy',
    species: 'dog',
    parent: { id: 'p1', firstName: 'Lena', lastName: 'Hartmann' },
  }),
}));

const mockGetOwnerFirstName = jest.fn(() => 'Lena' as string);
jest.mock('@/app/lib/companionName', () => ({
  getOwnerFirstName: () => mockGetOwnerFirstName(),
}));

jest.mock('@/app/lib/validators', () => ({
  toTitle: (s: string) => s,
}));

const baseInvoice = { id: 'inv-1', status: 'PAID', items: [], metadata: {} } as any;

expect.extend(toHaveNoViolations);

describe('InvoiceInfo', () => {
  beforeEach(() => {
    const invoiceLib = jest.requireMock('@/app/lib/invoice');
    (invoiceLib.getAppointmentByIdFromList as jest.Mock).mockReturnValue(undefined);
    mockPush.mockClear();
    mockIsPhone.mockReturnValue(false);
    mockGetParentById.mockReset();
    mockGetParentById.mockReturnValue(null);
    mockGetOwnerFirstName.mockReset();
    mockGetOwnerFirstName.mockReturnValue('Lena');
  });

  it('renders the modal with the desktop header and no Details/Payment tabs', () => {
    const setShowModal = jest.fn();
    render(<InvoiceInfo showModal setShowModal={setShowModal} activeInvoice={baseInvoice} />);

    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByTestId('invoice-header')).toBeInTheDocument();
    // The net-new segmented tabs are gone.
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('renders the clean two-column record (billed items, ledger, summary, billed-to)', () => {
    const setShowModal = jest.fn();
    render(<InvoiceInfo showModal setShowModal={setShowModal} activeInvoice={baseInvoice} />);

    expect(screen.getByTestId('billed-items')).toBeInTheDocument();
    expect(screen.getByTestId('summary-panel')).toBeInTheDocument();
    expect(screen.getByTestId('billed-to')).toBeInTheDocument();
    expect(screen.getByTestId('payment-ledger')).toBeInTheDocument();
  });

  it('does not render the removed EditableAccordions', () => {
    const setShowModal = jest.fn();
    render(<InvoiceInfo showModal setShowModal={setShowModal} activeInvoice={baseInvoice} />);

    expect(screen.queryByText('Appointment details')).not.toBeInTheDocument();
    expect(screen.queryByText('Payment details')).not.toBeInTheDocument();
  });

  it('renders the phone record instead of the desktop record below 768px', () => {
    mockIsPhone.mockReturnValue(true);
    const setShowModal = jest.fn();
    render(<InvoiceInfo showModal setShowModal={setShowModal} activeInvoice={baseInvoice} />);

    expect(screen.getByTestId('phone-record')).toBeInTheDocument();
    expect(screen.queryByTestId('invoice-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('billed-items')).not.toBeInTheDocument();
  });

  it('closes the modal from the desktop header close button', () => {
    const setShowModal = jest.fn();
    render(<InvoiceInfo showModal setShowModal={setShowModal} activeInvoice={baseInvoice} />);

    fireEvent.click(screen.getByText('close'));
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('closes the modal from the phone record close button', () => {
    mockIsPhone.mockReturnValue(true);
    const setShowModal = jest.fn();
    render(<InvoiceInfo showModal setShowModal={setShowModal} activeInvoice={baseInvoice} />);

    fireEvent.click(screen.getByText('phone-close'));
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('does not render when showModal is false', () => {
    const setShowModal = jest.fn();
    render(
      <InvoiceInfo showModal={false} setShowModal={setShowModal} activeInvoice={baseInvoice} />
    );
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('ignores the open-appointment action when no appointment is linked', () => {
    const setShowModal = jest.fn();
    render(<InvoiceInfo showModal setShowModal={setShowModal} activeInvoice={baseInvoice} />);

    fireEvent.click(screen.getByText('open-appointment'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('opens the linked appointment from the header action', () => {
    const invoiceLib = jest.requireMock('@/app/lib/invoice');
    (invoiceLib.getAppointmentByIdFromList as jest.Mock).mockReturnValue({
      id: 'appt-1',
      appointmentType: { name: 'Rabies booster' },
      organisationId: 'org-1',
    });

    const setShowModal = jest.fn();
    render(<InvoiceInfo showModal setShowModal={setShowModal} activeInvoice={baseInvoice} />);

    fireEvent.click(screen.getByText('open-appointment'));

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush.mock.calls[0][0]).toContain('appointmentId=appt-1');
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('opens the linked appointment from the phone record action', () => {
    mockIsPhone.mockReturnValue(true);
    const invoiceLib = jest.requireMock('@/app/lib/invoice');
    (invoiceLib.getAppointmentByIdFromList as jest.Mock).mockReturnValue({
      id: 'appt-2',
      appointmentType: { name: 'Suture check' },
      organisationId: 'org-1',
    });

    const setShowModal = jest.fn();
    render(<InvoiceInfo showModal setShowModal={setShowModal} activeInvoice={baseInvoice} />);

    fireEvent.click(screen.getByText('phone-open-appointment'));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush.mock.calls[0][0]).toContain('appointmentId=appt-2');
  });

  it('composes the payer name from a stored parent, tolerating a missing surname', () => {
    mockGetParentById.mockReturnValue({
      firstName: 'Lena',
      lastName: undefined,
      email: 'lena@x.com',
    });
    const setShowModal = jest.fn();
    render(
      <InvoiceInfo
        showModal
        setShowModal={setShowModal}
        activeInvoice={{ ...baseInvoice, parentId: 'p1' }}
      />
    );

    expect(screen.getByTestId('ledger-payer-name')).toHaveTextContent('Lena');
    expect(screen.getByTestId('ledger-payer-email')).toHaveTextContent('lena@x.com');
  });

  it('skips a stored parent whose name parts are all blank and clears the payer email', () => {
    mockGetParentById.mockReturnValue({ firstName: '  ', lastName: '', email: '' });
    const setShowModal = jest.fn();
    render(
      <InvoiceInfo
        showModal
        setShowModal={setShowModal}
        activeInvoice={{ ...baseInvoice, parentId: 'p1' }}
      />
    );

    expect(screen.getByTestId('ledger-payer-name').textContent).toBe('');
    expect(screen.getByTestId('ledger-payer-email').textContent).toBe('');
  });

  it('renders the shell without an active invoice, skipping every invoice-gated block', () => {
    const setShowModal = jest.fn();
    render(<InvoiceInfo showModal setShowModal={setShowModal} activeInvoice={null} />);

    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.queryByTestId('invoice-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('billed-items')).not.toBeInTheDocument();
  });

  it('renders no phone record when there is no active invoice on phone', () => {
    mockIsPhone.mockReturnValue(true);
    const setShowModal = jest.fn();
    render(<InvoiceInfo showModal setShowModal={setShowModal} activeInvoice={null} />);

    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.queryByTestId('phone-record')).not.toBeInTheDocument();
  });

  it('derives the parent id and payer name from a linked appointment when no stored parent', () => {
    const invoiceLib = jest.requireMock('@/app/lib/invoice');
    (invoiceLib.getAppointmentByIdFromList as jest.Mock).mockReturnValue({
      id: 'appt-1',
      appointmentType: { name: 'Rabies booster' },
      organisationId: 'org-1',
    });
    mockGetOwnerFirstName.mockReturnValue('Lena');

    const setShowModal = jest.fn();
    render(<InvoiceInfo showModal setShowModal={setShowModal} activeInvoice={baseInvoice} />);

    expect(screen.getByTestId('ledger-payer-name')).toHaveTextContent('Lena');
  });

  it('has no axe accessibility violations', async () => {
    const setShowModal = jest.fn();
    const { container } = render(
      <InvoiceInfo showModal setShowModal={setShowModal} activeInvoice={baseInvoice} />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
