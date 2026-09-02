import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import InvoiceStatusFilterPills from '@/app/features/finance/pages/Finance/Sections/InvoiceStatusFilterPills';

const options = [
  { name: 'All', key: 'all' },
  { name: 'Paid', key: 'paid' },
  { name: 'Pending', key: 'pending' },
] as any;

describe('InvoiceStatusFilterPills', () => {
  it('renders one pill per option and marks the active one pressed', () => {
    render(
      <InvoiceStatusFilterPills options={options} activeStatus="paid" setActiveStatus={jest.fn()} />
    );

    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Paid' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Pending' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    const active = screen.getByRole('button', { name: 'Paid' });
    // The design's filter chip: sentence case, solid ink when active, never an
    // ALL-CAPS status pill.
    expect(active).toHaveClass('h-8', 'rounded-full!', 'text-[12.5px]', 'font-bold');
    expect(active).toHaveClass('bg-[var(--chip-selected-bg)]');
    expect(active).not.toHaveClass('uppercase');
  });

  it('calls setActiveStatus with the option key on click', () => {
    const setActiveStatus = jest.fn();
    render(
      <InvoiceStatusFilterPills
        options={options}
        activeStatus="all"
        setActiveStatus={setActiveStatus}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));
    expect(setActiveStatus).toHaveBeenCalledWith('pending');
  });

  it('keeps one chip geometry whatever size the caller asks for', () => {
    render(
      <InvoiceStatusFilterPills
        options={options}
        activeStatus="all"
        setActiveStatus={jest.fn()}
        size="md"
      />
    );

    const allButton = screen.getByRole('button', { name: 'All' });
    expect(allButton).toHaveClass('h-8', 'px-[13px]', 'text-[12.5px]');
    expect(screen.getByRole('button', { name: 'Pending' })).toHaveClass('h-8', 'px-[13px]');
  });

  it('merges an extra className onto the group', () => {
    render(
      <InvoiceStatusFilterPills
        options={options}
        activeStatus="all"
        setActiveStatus={jest.fn()}
        className="flex-wrap"
      />
    );

    expect(screen.getByRole('group', { name: 'Filter invoices by status' }).className).toContain(
      'flex-wrap'
    );
  });
});
