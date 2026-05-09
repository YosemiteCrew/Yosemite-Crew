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
