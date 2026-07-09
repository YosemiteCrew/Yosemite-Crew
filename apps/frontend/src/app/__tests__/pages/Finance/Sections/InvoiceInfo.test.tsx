import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import InvoiceInfo from '@/app/features/finance/pages/Finance/Sections/InvoiceInfo';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
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

jest.mock('@/app/stores/parentStore', () => ({
  useParentStore: (selector: any) => selector({ getParentById: () => null }),
}));

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock('@/app/features/finance/pages/Finance/Sections/InvoiceDetailHeader', () => ({
  __esModule: true,
  default: ({ titleId, invoice, statusLabel, onClose }: any) => (
    <div data-testid="invoice-header">
      <h2 id={titleId}>{invoice?.id}</h2>
      <span>{statusLabel}</span>
      <button type="button" onClick={onClose}>
        close
      </button>
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
  default: () => <div data-testid="payment-ledger" />,
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
  getAppointmentByIdFromList: () => undefined,
}));

jest.mock('@/app/lib/validators', () => ({
  toTitle: (s: string) => s,
}));

const baseInvoice = { id: 'inv-1', status: 'PAID', items: [], metadata: {} } as any;

expect.extend(toHaveNoViolations);

describe('InvoiceInfo', () => {
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
    expect(screen.getByText('Status:')).toBeInTheDocument();
    // Status value rendered as badge in Pay card
    expect(screen.getAllByText('PAID').length).toBeGreaterThanOrEqual(1);
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
