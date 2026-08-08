import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
    const activePill = within(screen.getByRole('button', { name: 'Paid' })).getByText('Paid');
    expect(activePill).toHaveClass('rounded-full!', 'text-[10px]', 'font-bold', 'uppercase');
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

  it('keeps shared status pill geometry when size is md', () => {
    render(
      <InvoiceStatusFilterPills
        options={options}
        activeStatus="all"
        setActiveStatus={jest.fn()}
        size="md"
      />
    );

    const allButton = screen.getByRole('button', { name: 'All' });
    const allPill = within(allButton).getByText('All');
    expect(allButton).toHaveClass('min-h-[38px]', 'px-1', 'py-1');
    expect(allPill).toHaveClass('px-2.5', 'py-[3px]', 'text-[10px]');
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
