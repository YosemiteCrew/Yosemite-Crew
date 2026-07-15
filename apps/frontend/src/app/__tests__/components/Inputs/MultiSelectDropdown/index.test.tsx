import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MultiSelectDropdown from '@/app/ui/inputs/MultiSelectDropdown';

jest.mock('react-icons/io', () => ({
  IoIosWarning: () => <span>warning</span>,
}));

jest.mock('react-icons/fa6', () => ({
  FaCaretDown: () => <span>caret</span>,
}));

describe('MultiSelectDropdown', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis.window, 'innerHeight', {
      configurable: true,
      value: 900,
    });
  });

  it('renders a badge pill next to options that provide one', () => {
    render(
      <MultiSelectDropdown
        placeholder="Select"
        value={[]}
        onChange={jest.fn()}
        options={[
          { label: 'Consult', value: 'srv-1', badge: 'Service' },
          { label: 'Wellness', value: 'pkg-1', badge: 'Package' },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Select/i }));
    expect(screen.getByText('Service')).toBeInTheDocument();
    expect(screen.getByText('Package')).toBeInTheDocument();
  });

  it('adds and removes options', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <MultiSelectDropdown
        placeholder="Select"
        value={[]}
        onChange={onChange}
        options={['One', 'Two']}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Select/i }));
    fireEvent.click(screen.getByRole('button', { name: 'One', pressed: false }));
    expect(onChange).toHaveBeenCalledWith(['One']);

    rerender(
      <MultiSelectDropdown
        placeholder="Select"
        value={['One']}
        onChange={onChange}
        options={['One', 'Two']}
      />
    );

    expect(screen.getByText('One')).toBeInTheDocument();

    const selectedOption = screen.getByRole('button', { name: 'One', pressed: true });
    fireEvent.click(selectedOption);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('toggles options with arrow keys and enter', () => {
    const onChange = jest.fn();
    render(
      <MultiSelectDropdown
        placeholder="Select"
        value={[]}
        onChange={onChange}
        options={['One', 'Two']}
      />
    );

    const trigger = screen.getByRole('button', { name: /Select/i });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(['Two']);
  });

  it('renders selected values inside the input as comma-separated text', () => {
    render(
      <MultiSelectDropdown
        placeholder="Support"
        value={['One', 'Two']}
        onChange={jest.fn()}
        options={['One', 'Two']}
      />
    );

    expect(screen.getByText('One, Two')).toBeInTheDocument();
    expect(screen.queryByText('remove')).not.toBeInTheDocument();
  });

  it('supports home, end, and escape while open', () => {
    const onChange = jest.fn();
    render(
      <MultiSelectDropdown
        placeholder="Select"
        value={[]}
        onChange={onChange}
        options={['One', 'Two', 'Three']}
      />
    );

    const trigger = screen.getByRole('button', { name: /Select/i });
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'End' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['Three']);

    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'Home' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['One']);

    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: 'One', pressed: false })).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'One', pressed: false })).not.toBeInTheDocument();
  });

  it('resets an invalid selection when the available options change', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <MultiSelectDropdown
        placeholder="Select"
        value={['Missing']}
        onChange={onChange}
        options={['One', 'Two']}
      />
    );

    expect(screen.getByRole('button', { name: /Select/i })).toBeInTheDocument();

    rerender(
      <MultiSelectDropdown
        placeholder="Select"
        value={['Missing']}
        onChange={onChange}
        options={['Two']}
      />
    );

    const trigger = screen.getByRole('button', { name: /Select/i });
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['Missing', 'Two']);
  });
});
