import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import Dropdown from '@/app/ui/inputs/Dropdown';

jest.mock('react-icons/fa6', () => ({
  FaCaretDown: () => <span data-testid="caret" />,
}));

jest.mock('react-icons/io', () => ({
  IoIosWarning: () => <span data-testid="warning" />,
}));

describe('Dropdown (index)', () => {
  const options = [
    { key: 'day', label: 'Day' },
    { key: 'week', label: 'Week' },
  ];

  it('renders placeholder and toggles options', () => {
    render(<Dropdown placeholder="View" options={options} onSelect={jest.fn()} />);

    fireEvent.click(screen.getByText('View').closest('button')!);
    expect(screen.getByText('Day')).toBeInTheDocument();
    expect(screen.getByText('Week')).toBeInTheDocument();

    fireEvent.click(screen.getByText('View').closest('button')!);
    expect(screen.queryByText('Day')).not.toBeInTheDocument();
  });

  it('selects option and calls onSelect', () => {
    const onSelect = jest.fn();
    render(<Dropdown placeholder="View" options={options} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('View').closest('button')!);
    fireEvent.click(screen.getByText('Week'));

    expect(onSelect).toHaveBeenCalledWith(options[1]);
    expect(screen.queryByText('Day')).not.toBeInTheDocument();
  });

  it('selects option with arrow keys and enter', () => {
    const onSelect = jest.fn();
    render(<Dropdown placeholder="View" options={options} onSelect={onSelect} />);

    const trigger = screen.getByRole('button', { name: /View/i });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith(options[1]);
  });

  it('supports home, end, and escape keys', () => {
    const onSelect = jest.fn();
    render(<Dropdown placeholder="View" options={options} onSelect={onSelect} />);

    const trigger = screen.getByRole('button', { name: /View/i });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'End' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(options[1]);

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByText('Day')).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: 'Home' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(options[0]);

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getAllByRole('button', { name: 'Day' })).toHaveLength(2);
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.getAllByRole('button', { name: 'Day' })).toHaveLength(1);
  });

  it('applies the default option on mount', () => {
    render(
      <Dropdown placeholder="View" options={options} defaultOption="week" onSelect={jest.fn()} />
    );

    expect(screen.getByText('Week')).toBeInTheDocument();
  });

  it('shows error message', () => {
    render(<Dropdown placeholder="View" options={options} onSelect={jest.fn()} error="Required" />);

    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByTestId('warning')).toBeInTheDocument();
  });
});
