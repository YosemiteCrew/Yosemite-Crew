import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import CardHeader from '@/app/ui/cards/CardHeader/CardHeader';

describe('CardHeader', () => {
  const options = ['Last week', 'Last month', 'Last 6 months'];

  test('renders title and default option', () => {
    render(<CardHeader title="Explore" options={options} />);

    expect(screen.getByText('Explore')).toBeInTheDocument();
    // The toggle button label includes the current selection
    expect(
      screen.getByRole('button', { name: /Filter Explore by time period: Last week/i })
    ).toBeInTheDocument();
  });

  test('period trigger renders as a hairline rounded-full pill', () => {
    render(<CardHeader title="Explore" options={options} />);

    const toggle = screen.getByRole('button', {
      name: /Filter Explore by time period: Last week/i,
    });
    expect(toggle).toHaveClass('rounded-full', 'border', 'border-[var(--hairline)]');
    // Default 'card' variant: the compact in-card pill.
    expect(toggle).toHaveClass('text-[11.5px]', 'font-semibold', 'text-[var(--ink-muted)]');
    expect(toggle).toHaveClass('px-2.5', 'py-[5px]');
    expect(screen.getByText('Explore')).toHaveClass('text-[15px]');
  });

  test('the section variant renders the larger heading and pill', () => {
    render(<CardHeader title="Explore" options={options} variant="section" />);

    const toggle = screen.getByRole('button', {
      name: /Filter Explore by time period: Last week/i,
    });
    expect(toggle).toHaveClass('text-[12px]', 'px-3', 'py-1.5');
    expect(screen.getByText('Explore')).toHaveClass('text-[16px]');
  });

  test('uses controlled selection and calls onSelect', () => {
    const onSelect = jest.fn();
    render(
      <CardHeader title="Explore" options={options} selected="Last month" onSelect={onSelect} />
    );

    // Controlled value is reflected in the trigger label
    expect(
      screen.getByRole('button', { name: /Filter Explore by time period: Last month/i })
    ).toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: /Filter Explore by time period/i });
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: 'Last 6 months' }));

    expect(onSelect).toHaveBeenCalledWith('Last 6 months');
  });

  test('updates selection when option is clicked', () => {
    render(<CardHeader title="Explore" options={options} />);

    const toggle = screen.getByRole('button', { name: /Filter Explore by time period/i });
    fireEvent.click(toggle);

    const newOption = screen.getByRole('button', { name: 'Last month' });
    fireEvent.click(newOption);

    expect(
      screen.getByRole('button', { name: /Filter Explore by time period: Last month/i })
    ).toBeInTheDocument();
  });

  test('closes dropdown when clicking outside', () => {
    render(<CardHeader title="Explore" options={options} />);

    const toggle = screen.getByRole('button', { name: /Filter Explore by time period/i });
    fireEvent.click(toggle);
    expect(screen.getByText('Last 6 months')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Last 6 months')).not.toBeInTheDocument();
  });
});
