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

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
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

jest.mock('@/app/ui/tables/InvoiceTable', () => ({
  getStatusStyle: (status: string) => ({
    color: status === 'PAID' ? 'green' : 'gray',
    backgroundColor: status === 'PAID' ? '#e6f4ea' : '#f5f5f5',
    borderColor: status === 'PAID' ? '#34a853' : '#ccc',
  }),
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

const baseInvoice = { id: 'inv-1', status: 'PAID', metadata: {} } as any;

expect.extend(toHaveNoViolations);

describe('InvoiceInfo', () => {
  it('renders modal with tabs', () => {
    const setShowModal = jest.fn();
    render(<InvoiceInfo showModal setShowModal={setShowModal} activeInvoice={baseInvoice} />);

    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'View invoice' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Details' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Payment' })).toBeInTheDocument();
  });

  it('shows appointment details tab by default', () => {
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

  it('closes modal when close button clicked', () => {
    const setShowModal = jest.fn();
    render(<InvoiceInfo showModal setShowModal={setShowModal} activeInvoice={baseInvoice} />);

    const closeButtons = screen.getAllByText('close');
    fireEvent.click(closeButtons.at(-1)!);
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
    expect(screen.getByText('PAID')).toBeInTheDocument();
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
