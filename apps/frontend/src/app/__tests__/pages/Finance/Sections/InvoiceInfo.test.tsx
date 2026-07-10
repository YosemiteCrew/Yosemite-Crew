import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import InvoiceInfo from '@/app/features/finance/pages/Finance/Sections/InvoiceInfo';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: any) => <span>{alt}</span>,
}));

jest.mock('@/app/constants/mediaSources', () => ({
  MEDIA_SOURCES: { appointments: { stripe: '/stripe.png' } },
}));

jest.mock('@/app/hooks/useCompanionTerminologyText', () => ({
  useCompanionTerminologyText: () => (text: string) => text,
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

jest.mock('@/app/ui/primitives/Accordion/EditableAccordion', () => ({
  __esModule: true,
  default: ({ title, data, rightElement }: any) => (
    <div>
      <div>{title}</div>
      {rightElement}
      {data?.paymentMethod ? <div>{data.paymentMethod}</div> : null}
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/lib/invoicePaymentMethod', () => ({
  getInvoicePaymentMethodLabel: () => 'Paid in cash',
}));

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Finance/InvoicePaymentActions',
  () => ({
    __esModule: true,
    default: ({ invoiceId }: any) => <div data-testid="payment-actions">{invoiceId}</div>,
  })
);

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
  formatCompanionNameWithOwnerLastName: () => 'Lena Hartmann / Poppy',
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
    mockGetParentById.mockReset();
    mockGetParentById.mockReturnValue(null);
    mockGetOwnerFirstName.mockReset();
    mockGetOwnerFirstName.mockReturnValue('Lena');
  });

  it('renders modal with enriched header and tabs', () => {
    const setShowModal = jest.fn();
    render(<InvoiceInfo showModal setShowModal={setShowModal} activeInvoice={baseInvoice} />);

    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByTestId('invoice-header')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Details' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Payment' })).toBeInTheDocument();
  });

  it('renders the design billing sections on the details tab', () => {
    const setShowModal = jest.fn();
    render(<InvoiceInfo showModal setShowModal={setShowModal} activeInvoice={baseInvoice} />);

    expect(screen.getByTestId('billed-items')).toBeInTheDocument();
    expect(screen.getByTestId('summary-panel')).toBeInTheDocument();
    expect(screen.getByTestId('billed-to')).toBeInTheDocument();
    expect(screen.getByTestId('payment-ledger')).toBeInTheDocument();
  });

  it('shows appointment details accordions by default', () => {
    const setShowModal = jest.fn();
    render(<InvoiceInfo showModal setShowModal={setShowModal} activeInvoice={baseInvoice} />);

    expect(screen.getByText('Appointment details')).toBeInTheDocument();
    expect(screen.getByText('Payment details')).toBeInTheDocument();
  });

  it('switches to payment tab and shows Pay card with stripe logo', () => {
    const setShowModal = jest.fn();
    render(<InvoiceInfo showModal setShowModal={setShowModal} activeInvoice={baseInvoice} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Payment' }));
    expect(screen.getByTestId('payment-actions')).toBeInTheDocument();
    expect(screen.getByText('Pay')).toBeInTheDocument();
    expect(screen.getByText('Powered by stripe')).toBeInTheDocument();
  });

  it('exposes proper tab semantics for invoice sections', () => {
    const setShowModal = jest.fn();
    render(<InvoiceInfo showModal setShowModal={setShowModal} activeInvoice={baseInvoice} />);

    const detailsTab = screen.getByRole('tab', { name: 'Details' });
    const paymentTab = screen.getByRole('tab', { name: 'Payment' });

    expect(detailsTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      detailsTab.getAttribute('id')
    );

    fireEvent.click(paymentTab);

    expect(paymentTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      paymentTab.getAttribute('id')
    );
  });

  it('closes modal when header close button clicked', () => {
    const setShowModal = jest.fn();
    render(<InvoiceInfo showModal setShowModal={setShowModal} activeInvoice={baseInvoice} />);

    fireEvent.click(screen.getByText('close'));
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('does not render when showModal is false', () => {
    const setShowModal = jest.fn();
    render(
      <InvoiceInfo showModal={false} setShowModal={setShowModal} activeInvoice={baseInvoice} />
    );
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('shows status badge in accordion rightElement on details tab', () => {
    const setShowModal = jest.fn();
    render(<InvoiceInfo showModal setShowModal={setShowModal} activeInvoice={baseInvoice} />);

    // Status badge is rendered as rightElement in the Appointment details accordion
    expect(screen.getAllByText('PAID').length).toBeGreaterThanOrEqual(1);
  });

  it('shows status badge and row in payment tab Pay card', () => {
    const setShowModal = jest.fn();
    render(<InvoiceInfo showModal setShowModal={setShowModal} activeInvoice={baseInvoice} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Payment' }));
    expect(screen.getByText('Status')).toBeInTheDocument();
    // Status value rendered as badge in Pay card
    expect(screen.getAllByText('PAID').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the payment ledger on the payment tab', () => {
    const setShowModal = jest.fn();
    render(<InvoiceInfo showModal setShowModal={setShowModal} activeInvoice={baseInvoice} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Payment' }));
    expect(screen.getByTestId('payment-ledger')).toBeInTheDocument();
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

  it('composes the payer name from a stored parent, tolerating a missing surname', () => {
    // parentId present → useParentStore returns a stored parent → the storedParent
    // branch (InvoiceInfo L85-91) runs: firstName trims, undefined lastName short-circuits
    // the optional chain, and the non-empty composed value is returned as payerName.
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
    // storedParent is truthy but every name part trims to empty → composed collapses to ''
    // → the `if (composed)` arm is skipped and payerName falls through to '' (no appointment).
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
    // activeInvoice=null exercises the falsy arm of the header / details-billing / ledger guards
    // and the `activeInvoice?.x ?? default` nullish fallbacks throughout.
    const setShowModal = jest.fn();
    render(<InvoiceInfo showModal setShowModal={setShowModal} activeInvoice={null} />);

    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.queryByTestId('invoice-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('billed-items')).not.toBeInTheDocument();
    // The static accordions still render even without an invoice.
    expect(screen.getByText('Appointment details')).toBeInTheDocument();

    // Payment tab: no ledger (invoice-gated) but the Pay card status falls back to '-'.
    fireEvent.click(screen.getByRole('tab', { name: 'Payment' }));
    expect(screen.queryByTestId('payment-ledger')).not.toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('falls back the status label arms when the invoice status is empty', () => {
    const setShowModal = jest.fn();
    render(
      <InvoiceInfo
        showModal
        setShowModal={setShowModal}
        activeInvoice={{ ...baseInvoice, status: '' }}
      />
    );

    // Empty status → invoiceStatusLabel is '' → the accordion rightElement is omitted (details tab).
    expect(screen.queryByText('PAID')).not.toBeInTheDocument();

    // Payment tab: the status pill uses the `|| '-'` fallback.
    fireEvent.click(screen.getByRole('tab', { name: 'Payment' }));
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('falls back to a dash when a linked appointment has no owner first name', () => {
    const invoiceLib = jest.requireMock('@/app/lib/invoice');
    (invoiceLib.getAppointmentByIdFromList as jest.Mock).mockReturnValue({
      id: 'appt-1',
      appointmentType: { name: 'Rabies booster' },
      organisationId: 'org-1',
    });
    mockGetOwnerFirstName.mockReturnValue('');

    const setShowModal = jest.fn();
    render(<InvoiceInfo showModal setShowModal={setShowModal} activeInvoice={baseInvoice} />);

    // getOwnerFirstName() → '' exercises the `|| '-'` arm in appointmentInfoData and the
    // empty payer-name path (storedParent absent, appointment present).
    expect(screen.getByTestId('ledger-payer-name').textContent).toBe('');
    expect(screen.getByText('Appointment details')).toBeInTheDocument();
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
