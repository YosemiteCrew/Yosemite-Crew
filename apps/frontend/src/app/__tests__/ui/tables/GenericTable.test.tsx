import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import GenericTable from '@/app/ui/tables/GenericTable/GenericTable';

expect.extend(toHaveNoViolations);

describe('GenericTable', () => {
  it('renders an optional accessible caption and scoped column headers', () => {
    render(
      <GenericTable
        caption="Inventory summary"
        data={[{ name: 'Bandage', stock: 4 }]}
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'stock', label: 'Stock' },
        ]}
      />
    );

    expect(screen.getByText('Inventory summary')).toHaveClass('sr-only');
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('scope', 'col');
    expect(screen.getByRole('columnheader', { name: 'Stock' })).toHaveAttribute('scope', 'col');
  });

  it('has no axe accessibility violations with data', async () => {
    const { container } = render(
      <GenericTable
        caption="Inventory summary"
        data={[
          { name: 'Bandage', stock: 4 },
          { name: 'Syringe', stock: 10 },
        ]}
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'stock', label: 'Stock' },
        ]}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe accessibility violations with empty data', async () => {
    const { container } = render(
      <GenericTable
        caption="Empty inventory"
        data={[]}
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'stock', label: 'Stock' },
        ]}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
