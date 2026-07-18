import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import InvoicePaymentLedger from '@/app/features/finance/pages/Finance/Sections/InvoicePaymentLedger';
import { Invoice } from '@yosemite-crew/types';

expect.extend(toHaveNoViolations);

jest.mock('@/app/lib/forms', () => ({
  formatDateLabel: jest.fn(() => '12 Jun'),
  formatTimeLabel: jest.fn(() => '10:31'),
}));

jest.mock('@/app/lib/invoicePaymentMethod', () => ({
  getInvoicePaymentMethodLabel: jest.fn(() => 'Online payment'),
}));

jest.mock('react-icons/io5', () => ({
  IoCardOutline: () => <span data-testid="card-icon" />,
  IoCheckmarkCircle: () => <span data-testid="check-icon" />,
}));

const makeInvoice = (overrides: Partial<Invoice>): Invoice =>
  ({
    id: 'inv',
    items: [],
    subtotal: 86,
    totalAmount: 86,
    status: 'PAID',
    currency: 'USD',
    paymentCollectionMethod: 'PAYMENT_INTENT',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Invoice;

describe('InvoicePaymentLedger', () => {
  it('renders nothing for an unsettled invoice without a paid timestamp', () => {
    const { container } = render(
      <InvoicePaymentLedger invoice={makeInvoice({ status: 'PENDING' })} currency="USD" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a payment row with caption, amount, receipt and receipt-sent strip', () => {
    render(
      <InvoicePaymentLedger
        invoice={makeInvoice({ stripeReceiptUrl: 'https://stripe.test/r/1' })}
        currency="USD"
        payerName="Lena Hartmann"
        payerEmail="lena@mail.de"
      />
    );

    expect(screen.getByText('Payment recorded')).toBeInTheDocument();
    expect(
      screen.getByText('Online payment · 12 Jun, 10:31 · by Lena Hartmann')
    ).toBeInTheDocument();
    expect(screen.getByText('$86')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Receipt' })).toHaveAttribute(
      'href',
      'https://stripe.test/r/1'
    );
    expect(screen.getByText('Receipt sent to lena@mail.de')).toBeInTheDocument();
  });

  it('treats a paidAt timestamp as settled even when status is not paid', () => {
    render(
      <InvoicePaymentLedger
        invoice={makeInvoice({ status: 'PENDING', paidAt: new Date() })}
        currency="USD"
      />
    );
    expect(screen.getByText('Payment recorded')).toBeInTheDocument();
  });

  it('omits the receipt link and receipt-sent strip when data is missing', () => {
    render(<InvoicePaymentLedger invoice={makeInvoice({})} currency="USD" />);

    expect(screen.queryByRole('link', { name: 'Receipt' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Receipt sent to/)).not.toBeInTheDocument();
  });

  it('renders a bare payment row when method, timestamps and amount are unavailable', () => {
    const { getInvoicePaymentMethodLabel } = jest.requireMock('@/app/lib/invoicePaymentMethod');
    const forms = jest.requireMock('@/app/lib/forms');
    (getInvoicePaymentMethodLabel as jest.Mock).mockReturnValueOnce('-');
    (forms.formatDateLabel as jest.Mock).mockReturnValueOnce('');
    (forms.formatTimeLabel as jest.Mock).mockReturnValueOnce('');
    render(
      <InvoicePaymentLedger invoice={makeInvoice({ totalAmount: undefined })} currency="USD" />
    );
    expect(screen.getByText('Payment recorded')).toBeInTheDocument();
    expect(screen.getByText('$0')).toBeInTheDocument();
  });

  it('has no axe accessibility violations', async () => {
    const { container } = render(
      <InvoicePaymentLedger
        invoice={makeInvoice({ stripeReceiptUrl: 'https://stripe.test/r/1' })}
        currency="USD"
        payerName="Lena Hartmann"
        payerEmail="lena@mail.de"
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
