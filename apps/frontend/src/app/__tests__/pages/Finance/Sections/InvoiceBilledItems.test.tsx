import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import InvoiceBilledItems from '@/app/features/finance/pages/Finance/Sections/InvoiceBilledItems';
import { InvoiceItem } from '@yosemite-crew/types';

expect.extend(toHaveNoViolations);

const items: InvoiceItem[] = [
  { id: 'i1', name: 'Vaccination visit', quantity: 1, unitPrice: 49, total: 49 },
  { name: 'Nobivac Rabies 1 ml', quantity: 2, unitPrice: 24, total: 48 },
];

describe('InvoiceBilledItems', () => {
  it('renders a row per billed item with quantity and money', () => {
    render(<InvoiceBilledItems items={items} currency="USD" />);

    expect(screen.getByRole('heading', { name: 'Billed items' })).toBeInTheDocument();
    expect(screen.getByText('Vaccination visit')).toBeInTheDocument();
    expect(screen.getByText('Nobivac Rabies 1 ml')).toBeInTheDocument();
    // Gross and amount of the first row both format to $49.
    expect(screen.getAllByText('$49')).toHaveLength(2);
    expect(screen.getByText('$24')).toBeInTheDocument();
    expect(screen.getByText('$48')).toBeInTheDocument();
  });

  it('renders an honest empty state when there are no items', () => {
    render(<InvoiceBilledItems items={[]} currency="USD" />);
    expect(screen.getByText('No billed items recorded for this invoice.')).toBeInTheDocument();
  });

  it('falls back to zero for items missing unit price and total', () => {
    render(
      <InvoiceBilledItems
        items={[{ name: 'Waste & sharps fee', quantity: 1 } as InvoiceItem]}
        currency="USD"
      />
    );
    expect(screen.getByText('Waste & sharps fee')).toBeInTheDocument();
    // gross and amount both fall back to $0
    expect(screen.getAllByText('$0').length).toBeGreaterThanOrEqual(2);
  });

  it('has no axe accessibility violations', async () => {
    const { container } = render(<InvoiceBilledItems items={items} currency="USD" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
