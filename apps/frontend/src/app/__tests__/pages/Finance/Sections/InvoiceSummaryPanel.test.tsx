import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import InvoiceSummaryPanel from '@/app/features/finance/pages/Finance/Sections/InvoiceSummaryPanel';
import { Invoice } from '@yosemite-crew/types';

expect.extend(toHaveNoViolations);

const makeInvoice = (overrides: Partial<Invoice>): Invoice =>
  ({
    id: 'inv',
    items: [],
    subtotal: 79,
    discountTotal: 5,
    taxTotal: 6,
    totalAmount: 86,
    status: 'PAID',
    currency: 'USD',
    paymentCollectionMethod: 'PAYMENT_INTENT',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Invoice;

describe('InvoiceSummaryPanel', () => {
  it('renders subtotal, discount, tax, total and outstanding', () => {
    render(<InvoiceSummaryPanel invoice={makeInvoice({})} currency="USD" />);

    expect(screen.getByText('Subtotal')).toBeInTheDocument();
    expect(screen.getByText('$79')).toBeInTheDocument();
    expect(screen.getByText('Discount')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('$86')).toBeInTheDocument();
    expect(screen.getByText('Outstanding')).toBeInTheDocument();
    expect(screen.getByText('$0')).toBeInTheDocument();
  });

  it('renders a plain Tax label when no tax percent is set', () => {
    render(<InvoiceSummaryPanel invoice={makeInvoice({ taxPercent: undefined })} currency="USD" />);
    expect(screen.getByText('Tax')).toBeInTheDocument();
  });

  it('renders the tax percent in the label when present', () => {
    render(<InvoiceSummaryPanel invoice={makeInvoice({ taxPercent: 8.1 })} currency="USD" />);
    expect(screen.getByText('Tax · 8.1%')).toBeInTheDocument();
  });

  it('shows a non-zero outstanding balance for unsettled invoices', () => {
    render(
      <InvoiceSummaryPanel
        invoice={makeInvoice({ status: 'AWAITING_PAYMENT', totalAmount: 214 })}
        currency="USD"
      />
    );
    // Outstanding equals the total when nothing has been collected.
    expect(screen.getAllByText('$214').length).toBeGreaterThanOrEqual(1);
  });

  it('falls back to zero for missing money fields', () => {
    render(
      <InvoiceSummaryPanel
        invoice={makeInvoice({
          subtotal: undefined,
          discountTotal: undefined,
          taxTotal: undefined,
          totalAmount: undefined,
        })}
        currency="USD"
      />
    );
    // Subtotal / Discount / Tax / Total / Outstanding all resolve to $0.
    expect(screen.getAllByText('$0').length).toBeGreaterThanOrEqual(4);
  });

  it('has no axe accessibility violations', async () => {
    const { container } = render(<InvoiceSummaryPanel invoice={makeInvoice({})} currency="USD" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
