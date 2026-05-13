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
    fireEvent.click(screen.getByRole('button', { name: 'One' }));
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

    fireEvent.click(screen.getByText('One'));
    const oneButtons = screen.getAllByRole('button', { name: 'One' });
    const selectedOption = oneButtons.at(-1);
    expect(selectedOption).toBeDefined();
    fireEvent.click(selectedOption!);
    expect(onChange).toHaveBeenCalledWith([]);
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
});
