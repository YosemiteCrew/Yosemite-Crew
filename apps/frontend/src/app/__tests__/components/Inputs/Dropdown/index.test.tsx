import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import Dropdown from '@/app/ui/inputs/Dropdown';

jest.mock('react-icons/io5', () => ({
  IoChevronDown: () => <span data-testid="caret" />,
}));

jest.mock('react-icons/io', () => ({
  IoIosWarning: () => <span data-testid="warning" />,
}));

/** The active option is the only one carrying the exact `bg-card-hover` class token. */
const activeOptionLabel = () =>
  screen.getAllByRole('button').find((button) => button.classList.contains('bg-card-hover'))
    ?.textContent;

describe('Dropdown (index)', () => {
  const options = [
    { key: 'day', label: 'Day' },
    { key: 'week', label: 'Week' },
  ];

  const threeOptions = [
    { key: 'day', label: 'Day' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
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

  it('keeps the placeholder when the default option matches nothing', () => {
    render(
      <Dropdown placeholder="View" options={options} defaultOption="year" onSelect={jest.fn()} />
    );

    expect(screen.getByRole('button', { name: /View/i })).toBeInTheDocument();
    expect(screen.queryByText('Week')).not.toBeInTheDocument();
  });

  it('re-applies the default option when the prop changes', () => {
    const { rerender } = render(
      <Dropdown placeholder="View" options={options} defaultOption="day" onSelect={jest.fn()} />
    );
    expect(screen.getByRole('button', { name: /Day/i })).toBeInTheDocument();

    rerender(
      <Dropdown placeholder="View" options={options} defaultOption="week" onSelect={jest.fn()} />
    );
    expect(screen.getByRole('button', { name: /Week/i })).toBeInTheDocument();
  });

  it('closes when a mousedown lands outside and stays open for one inside', () => {
    render(<Dropdown placeholder="View" options={options} onSelect={jest.fn()} />);

    const trigger = screen.getByRole('button', { name: /View/i });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Inside the dropdown root: `contains` is true, so the panel stays open.
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Day' }));
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Outside the dropdown root: `contains` is false, so the panel closes.
    fireEvent.mouseDown(document.body);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Day' })).not.toBeInTheDocument();
  });

  it('wraps the active option forwards and backwards with the arrow keys', () => {
    const onSelect = jest.fn();
    render(<Dropdown placeholder="View" options={threeOptions} onSelect={onSelect} />);

    const trigger = screen.getByRole('button', { name: /View/i });

    // Closed: the first ArrowDown only opens the panel and lands on the first option.
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(activeOptionLabel()).toBe('Day');

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(activeOptionLabel()).toBe('Week');

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(activeOptionLabel()).toBe('Month');

    // Past the end: wraps back to the first option.
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(activeOptionLabel()).toBe('Day');

    // Before the start: wraps to the last option.
    fireEvent.keyDown(trigger, { key: 'ArrowUp' });
    expect(activeOptionLabel()).toBe('Month');

    fireEvent.keyDown(trigger, { key: 'ArrowUp' });
    expect(activeOptionLabel()).toBe('Week');

    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(threeOptions[1]);
  });

  it('opens on ArrowUp when closed', () => {
    render(<Dropdown placeholder="View" options={options} onSelect={jest.fn()} />);

    const trigger = screen.getByRole('button', { name: /View/i });
    fireEvent.keyDown(trigger, { key: 'ArrowUp' });

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(activeOptionLabel()).toBe('Day');
  });

  it('highlights the option under the pointer', () => {
    render(<Dropdown placeholder="View" options={threeOptions} onSelect={jest.fn()} />);

    const trigger = screen.getByRole('button', { name: /View/i });
    fireEvent.click(trigger);
    expect(activeOptionLabel()).toBe('Day');

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Month' }));
    expect(activeOptionLabel()).toBe('Month');
  });

  it('starts on the selected option when reopened', () => {
    render(
      <Dropdown
        placeholder="View"
        options={threeOptions}
        defaultOption="month"
        onSelect={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Month/i }));

    expect(activeOptionLabel()).toBe('Month');
  });

  it('keeps the active option when the options array identity changes while open', () => {
    const onSelect = jest.fn();
    const { rerender } = render(
      <Dropdown placeholder="View" options={threeOptions} onSelect={onSelect} />
    );

    const trigger = screen.getByRole('button', { name: /View/i });
    fireEvent.click(trigger);
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Week' }));
    expect(activeOptionLabel()).toBe('Week');

    // A new array with identical contents: the still-valid active index survives.
    rerender(
      <Dropdown
        placeholder="View"
        options={[
          { key: 'day', label: 'Day' },
          { key: 'week', label: 'Week' },
          { key: 'month', label: 'Month' },
        ]}
        onSelect={onSelect}
      />
    );

    expect(activeOptionLabel()).toBe('Week');
  });

  it('ignores the arrow keys when there are no options', () => {
    render(<Dropdown placeholder="View" options={[]} onSelect={jest.fn()} />);

    const trigger = screen.getByRole('button', { name: /View/i });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.keyDown(trigger, { key: 'ArrowUp' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens on Enter when closed and ignores Enter without an active option', () => {
    const onSelect = jest.fn();
    render(<Dropdown placeholder="View" options={[]} onSelect={onSelect} />);

    const trigger = screen.getByRole('button', { name: /View/i });

    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Open with an empty list: there is no active option to confirm.
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onSelect).not.toHaveBeenCalled();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('confirms the active option with the space key', () => {
    const onSelect = jest.fn();
    render(<Dropdown placeholder="View" options={options} onSelect={onSelect} />);

    const trigger = screen.getByRole('button', { name: /View/i });
    fireEvent.keyDown(trigger, { key: ' ' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(trigger, { key: ' ' });
    expect(onSelect).toHaveBeenCalledWith(options[0]);
  });

  it('ignores Home and End while closed', () => {
    render(<Dropdown placeholder="View" options={options} onSelect={jest.fn()} />);

    const trigger = screen.getByRole('button', { name: /View/i });
    fireEvent.keyDown(trigger, { key: 'Home' });
    fireEvent.keyDown(trigger, { key: 'End' });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('ignores Home and End while open with no options', () => {
    const onSelect = jest.fn();
    render(<Dropdown placeholder="View" options={[]} onSelect={onSelect} />);

    const trigger = screen.getByRole('button', { name: /View/i });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(trigger, { key: 'Home' });
    fireEvent.keyDown(trigger, { key: 'End' });

    expect(onSelect).not.toHaveBeenCalled();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('ignores unhandled keys', () => {
    const onSelect = jest.fn();
    render(<Dropdown placeholder="View" options={options} onSelect={onSelect} />);

    const trigger = screen.getByRole('button', { name: /View/i });
    fireEvent.keyDown(trigger, { key: 'Tab' });
    fireEvent.keyDown(trigger, { key: 'a' });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(onSelect).not.toHaveBeenCalled();
  });
});
