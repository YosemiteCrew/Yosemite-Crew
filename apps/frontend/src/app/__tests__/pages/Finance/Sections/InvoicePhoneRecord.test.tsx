import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import InvoicePhoneRecord from '@/app/features/finance/pages/Finance/Sections/InvoicePhoneRecord';
import { formatDateLabel, formatTimeLabel } from '@/app/lib/forms';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: any) => <span>{alt}</span>,
}));

jest.mock('@/app/lib/money', () => ({
  formatMoney: (amount: number) => `€${amount}`,
  recordCurrency: (record: { currency?: string | null } | null | undefined, fallback: string) =>
    record?.currency ?? fallback,
  formatMoneyPrecise: (amount: number, currency: string) =>
    `${currency} ${Number(amount).toFixed(2)}`,
}));

jest.mock('@/app/lib/forms', () => ({
  formatDateLabel: jest.fn(() => '12 Jun'),
  formatTimeLabel: jest.fn(() => '10:31'),
}));

jest.mock('@/app/lib/invoice', () => ({
  getInvoiceNumberLabel: (i: any) => (i.id ? `#${i.id}` : ''),
}));

jest.mock('@/app/lib/invoicePaymentMethod', () => ({
  getInvoicePaymentMethodLabel: (i: any) => i.method ?? '-',
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeImageUrl: () => '/img.png',
  ImageType: {},
}));

const getAppointmentCompanionMock = jest.fn(() => ({
  species: 'dog',
  name: 'Poppy',
  parent: {},
}));
jest.mock('@/app/lib/appointments', () => ({
  getAppointmentCompanion: () => getAppointmentCompanionMock(),
  getAppointmentCompanionPhotoUrl: () => undefined,
}));

jest.mock('@/app/lib/companionName', () => ({
  formatCompanionNameWithOwnerLastName: () => 'Poppy Hartmann',
}));

const appointment = { id: 'appt-1', appointmentType: { name: 'Rabies booster' } } as any;

const baseInvoice = {
  id: '2038',
  status: 'PAID',
  items: [
    { id: 'i1', name: 'Vaccination visit', total: 49 },
    { id: 'i2', name: 'Nobivac Rabies', total: 24.8 },
  ],
  taxTotal: 6.4,
  taxPercent: 8.1,
  discountTotal: 0,
  totalAmount: 86.2,
  paidAt: '2026-06-12',
  stripeReceiptUrl: 'https://receipt',
  pdfUrl: 'https://pdf',
  method: 'Stripe',
} as any;

const baseProps = {
  titleId: 'title-1',
  invoice: baseInvoice,
  appointment,
  currency: 'EUR',
  statusLabel: 'Paid',
  statusStyle: {},
  payerName: 'Lena Hartmann',
  onClose: jest.fn(),
  onOpenAppointment: jest.fn(),
};

describe('InvoicePhoneRecord', () => {
  beforeEach(() => {
    getAppointmentCompanionMock.mockReturnValue({ species: 'dog', name: 'Poppy', parent: {} });
    (formatDateLabel as jest.Mock).mockReturnValue('12 Jun');
    (formatTimeLabel as jest.Mock).mockReturnValue('10:31');
  });

  it('renders the header with number, status and subtitle', () => {
    render(<InvoicePhoneRecord {...baseProps} />);

    expect(screen.getByRole('heading', { name: '#2038' })).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Poppy Hartmann · 12 Jun')).toBeInTheDocument();
  });

  it('renders billed items, the tax row and a big total', () => {
    render(<InvoicePhoneRecord {...baseProps} />);

    expect(screen.getByText('Vaccination visit')).toBeInTheDocument();
    expect(screen.getByText('Nobivac Rabies')).toBeInTheDocument();
    expect(screen.getByText('Tax 8.1%')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('EUR 86.20')).toBeInTheDocument();
  });

  it('renders the empty items note when there are no items', () => {
    render(<InvoicePhoneRecord {...baseProps} invoice={{ ...baseInvoice, items: [] }} />);
    expect(screen.getByText('No billed items recorded.')).toBeInTheDocument();
  });

  it('renders a discount row only when there is a discount', () => {
    const { rerender } = render(<InvoicePhoneRecord {...baseProps} />);
    expect(screen.queryByText('Discount')).not.toBeInTheDocument();

    rerender(<InvoicePhoneRecord {...baseProps} invoice={{ ...baseInvoice, discountTotal: 5 }} />);
    expect(screen.getByText('Discount')).toBeInTheDocument();
    expect(screen.getByText('-EUR 5.00')).toBeInTheDocument();
  });

  it('renders the payment ledger and receipt link when settled', () => {
    render(<InvoicePhoneRecord {...baseProps} />);

    expect(screen.getByText('Payment recorded')).toBeInTheDocument();
    expect(screen.getByText('Stripe · 12 Jun 10:31 · Lena Hartmann')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Receipt' })).toHaveAttribute(
      'href',
      'https://receipt'
    );
    // Same as the desktop ledger: an address on file is not proof of delivery.
    expect(screen.queryByText(/Receipt sent to/)).not.toBeInTheDocument();
    expect(screen.queryByText(/lena@x.com/)).not.toBeInTheDocument();
  });

  it('labels the payment row by the channel the payment came through', () => {
    const { rerender } = render(
      <InvoicePhoneRecord
        {...baseProps}
        invoice={{ ...baseInvoice, paymentCollectionMethod: 'PAYMENT_INTENT' }}
      />
    );
    expect(screen.getByText('Paid in the pet-parent app')).toBeInTheDocument();

    rerender(
      <InvoicePhoneRecord
        {...baseProps}
        invoice={{ ...baseInvoice, paymentCollectionMethod: 'PAYMENT_LINK' }}
      />
    );
    expect(screen.getByText('Paid in the pet-parent app')).toBeInTheDocument();

    rerender(
      <InvoicePhoneRecord
        {...baseProps}
        invoice={{ ...baseInvoice, paymentCollectionMethod: 'PAYMENT_AT_CLINIC' }}
      />
    );
    expect(screen.getByText('Paid at the clinic')).toBeInTheDocument();
  });

  it('omits the payment ledger when the invoice is not settled', () => {
    render(
      <InvoicePhoneRecord
        {...baseProps}
        invoice={{ ...baseInvoice, status: 'PENDING', paidAt: undefined }}
      />
    );
    expect(screen.queryByText('Payment recorded')).not.toBeInTheDocument();
    expect(screen.queryByText('Receipt sent to lena@x.com')).not.toBeInTheDocument();
  });

  it('uses a plain Tax label when no tax percent is present', () => {
    render(
      <InvoicePhoneRecord {...baseProps} invoice={{ ...baseInvoice, taxPercent: undefined }} />
    );
    expect(screen.getByText('Tax')).toBeInTheDocument();
  });

  it('renders the PDF and Open appointment buttons and wires their handlers', () => {
    const onOpenAppointment = jest.fn();
    render(<InvoicePhoneRecord {...baseProps} onOpenAppointment={onOpenAppointment} />);

    expect(screen.getByRole('link', { name: /Download invoice/ })).toHaveAttribute(
      'href',
      'https://pdf'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open appointment' }));
    expect(onOpenAppointment).toHaveBeenCalledTimes(1);
  });

  it('hides the actions row when there is no PDF and no appointment', () => {
    render(
      <InvoicePhoneRecord
        {...baseProps}
        appointment={undefined}
        invoice={{ ...baseInvoice, pdfUrl: undefined }}
      />
    );
    expect(screen.queryByRole('button', { name: 'Open appointment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Download invoice/ })).not.toBeInTheDocument();
  });

  it('calls onClose from the close button', () => {
    const onClose = jest.fn();
    render(<InvoicePhoneRecord {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders a date-only subtitle when there is no linked appointment', () => {
    render(<InvoicePhoneRecord {...baseProps} appointment={undefined} />);
    expect(screen.getByText('12 Jun')).toBeInTheDocument();
  });

  it('omits the status badge when the status label is empty', () => {
    render(<InvoicePhoneRecord {...baseProps} statusLabel="" />);
    expect(screen.getByRole('heading', { name: '#2038' })).toBeInTheDocument();
    expect(screen.queryByText('Paid')).not.toBeInTheDocument();
  });

  it('omits the timestamp from the ledger caption when no date or time is available', () => {
    (formatDateLabel as jest.Mock).mockReturnValue('');
    (formatTimeLabel as jest.Mock).mockReturnValue('');
    render(<InvoicePhoneRecord {...baseProps} />);
    expect(screen.getByText('Stripe · Lena Hartmann')).toBeInTheDocument();
  });

  it('builds the ledger caption without a payer name or method', () => {
    render(
      <InvoicePhoneRecord
        {...baseProps}
        payerName=""
        invoice={{ ...baseInvoice, method: undefined }}
      />
    );
    expect(screen.getByText('12 Jun 10:31')).toBeInTheDocument();
  });

  it('omits the receipt link when there is no receipt url', () => {
    render(
      <InvoicePhoneRecord
        {...baseProps}
        invoice={{ ...baseInvoice, stripeReceiptUrl: undefined }}
      />
    );
    expect(screen.getByText('Payment recorded')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Receipt' })).not.toBeInTheDocument();
  });

  it('renders only the Open appointment button when there is no PDF', () => {
    render(<InvoicePhoneRecord {...baseProps} invoice={{ ...baseInvoice, pdfUrl: undefined }} />);
    expect(screen.queryByRole('link', { name: /Download invoice/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open appointment' })).toBeInTheDocument();
  });

  it('renders only the PDF button when there is no appointment', () => {
    render(<InvoicePhoneRecord {...baseProps} appointment={undefined} />);
    expect(screen.getByRole('link', { name: /Download invoice/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open appointment' })).not.toBeInTheDocument();
  });

  it('applies money and label fallbacks when item/tax/total fields are missing', () => {
    render(
      <InvoicePhoneRecord
        {...baseProps}
        payerName={undefined}
        invoice={{
          ...baseInvoice,
          items: [{ name: 'Loose item' }],
          taxTotal: undefined,
          totalAmount: undefined,
          taxPercent: undefined,
        }}
      />
    );
    expect(screen.getByText('Loose item')).toBeInTheDocument();
    expect(screen.getByText('Tax')).toBeInTheDocument();
  });

  it('falls back to the generic species avatar when the companion has no species', () => {
    getAppointmentCompanionMock.mockReturnValue({ name: 'Poppy', parent: {} } as any);
    render(<InvoicePhoneRecord {...baseProps} />);
    expect(screen.getByRole('heading', { name: '#2038' })).toBeInTheDocument();
  });

  it('applies the number, items and discount fallbacks when those fields are absent', () => {
    render(<InvoicePhoneRecord {...baseProps} invoice={{ status: 'PENDING' } as any} />);
    expect(screen.getByRole('heading', { name: 'Invoice' })).toBeInTheDocument();
    expect(screen.getByText('No billed items recorded.')).toBeInTheDocument();
    expect(screen.queryByText('Discount')).not.toBeInTheDocument();
  });
});
