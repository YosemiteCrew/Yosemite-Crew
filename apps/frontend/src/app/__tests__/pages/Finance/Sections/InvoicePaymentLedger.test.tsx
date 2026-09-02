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
  IoPhonePortraitOutline: () => <span data-testid="phone-icon" />,
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

  it('renders a payment row with caption, amount and the real receipt link', () => {
    render(
      <InvoicePaymentLedger
        invoice={makeInvoice({ stripeReceiptUrl: 'https://pay.stripe.com/receipts/r_1' })}
        currency="USD"
        payerName="Lena Hartmann"
      />
    );

    expect(screen.getByText('Paid in the pet-parent app')).toBeInTheDocument();
    expect(
      screen.getByText('Online payment · 12 Jun, 10:31 · by Lena Hartmann')
    ).toBeInTheDocument();
    expect(screen.getByText('$86.00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Receipt' })).toHaveAttribute(
      'href',
      'https://pay.stripe.com/receipts/r_1'
    );
    // No "Receipt sent to ...". Having the payer's address on file is not
    // evidence anything was delivered, and nothing in the product emails an
    // invoice receipt.
    expect(screen.queryByText(/Receipt sent to/)).not.toBeInTheDocument();
  });

  it('never claims a receipt was sent, even with a payer email and a receipt url', () => {
    render(
      <InvoicePaymentLedger
        invoice={makeInvoice({ stripeReceiptUrl: 'https://pay.stripe.com/receipts/r_1' })}
        currency="USD"
        payerName="Lena Hartmann"
      />
    );

    expect(screen.queryByText(/Receipt sent to/)).not.toBeInTheDocument();
    expect(screen.queryByText(/lena@example.com/)).not.toBeInTheDocument();
    // The link, which is a real signal, is still offered.
    expect(screen.getByRole('link', { name: 'Receipt' })).toBeInTheDocument();
  });

  it('treats a paidAt timestamp as settled even when status is not paid', () => {
    render(
      <InvoicePaymentLedger
        invoice={makeInvoice({ status: 'PENDING', paidAt: new Date() })}
        currency="USD"
      />
    );
    expect(screen.getByText('Paid in the pet-parent app')).toBeInTheDocument();
  });

  it('labels the row by the channel the payment came through', () => {
    const { rerender } = render(
      <InvoicePaymentLedger
        invoice={makeInvoice({ paymentCollectionMethod: 'PAYMENT_LINK' })}
        currency="USD"
      />
    );
    expect(screen.getByText('Paid in the pet-parent app')).toBeInTheDocument();
    expect(screen.getByTestId('phone-icon')).toBeInTheDocument();

    rerender(
      <InvoicePaymentLedger
        invoice={makeInvoice({ paymentCollectionMethod: 'PAYMENT_AT_CLINIC' })}
        currency="USD"
      />
    );
    expect(screen.getByText('Paid at the clinic')).toBeInTheDocument();
    expect(screen.getByTestId('card-icon')).toBeInTheDocument();

    rerender(
      <InvoicePaymentLedger
        invoice={makeInvoice({ paymentCollectionMethod: undefined })}
        currency="USD"
      />
    );
    expect(screen.getByText('Payment recorded')).toBeInTheDocument();
    expect(screen.getByTestId('card-icon')).toBeInTheDocument();
  });

  it('omits the receipt link when there is no receipt url', () => {
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
    expect(screen.getByText('Paid in the pet-parent app')).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  it('has no axe accessibility violations', async () => {
    const { container } = render(
      <InvoicePaymentLedger
        invoice={makeInvoice({ stripeReceiptUrl: 'https://pay.stripe.com/receipts/r_1' })}
        currency="USD"
        payerName="Lena Hartmann"
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('drops a receipt link that is not a Stripe https URL', () => {
    // React does not sanitize href protocols, so an invoice record carrying a
    // javascript: URL would execute on click.
    render(
      <InvoicePaymentLedger
        invoice={makeInvoice({ stripeReceiptUrl: 'javascript:alert(1)' })}
        currency="USD"
      />
    );

    expect(screen.queryByRole('link', { name: 'Receipt' })).not.toBeInTheDocument();
  });
});
