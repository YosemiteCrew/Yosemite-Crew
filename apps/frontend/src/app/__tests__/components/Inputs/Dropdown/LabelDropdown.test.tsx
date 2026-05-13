import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';

jest.mock('react-icons/fa6', () => ({
  FaCaretDown: () => <span data-testid="icon-caret" />,
}));

jest.mock('react-icons/io', () => ({
  IoIosWarning: () => <span data-testid="icon-warning" />,
}));

expect.extend(toHaveNoViolations);

describe('LabelDropdown', () => {
  const options = [
    { label: 'Canine', value: 'dog' },
    { label: 'Feline', value: 'cat' },
  ];

  it('renders placeholder and error when no selection', () => {
    render(
      <LabelDropdown
        placeholder="Species"
        options={options}
        onSelect={jest.fn()}
        error="Required"
      />
    );

    expect(screen.getByRole('button', { name: /Species/i })).toBeInTheDocument();
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByTestId('icon-warning')).toBeInTheDocument();
  });

  it('opens and selects an option', () => {
    const onSelect = jest.fn();
    render(<LabelDropdown placeholder="Species" options={options} onSelect={onSelect} />);

    // Click the trigger button to open the dropdown
    fireEvent.click(screen.getByRole('button', { name: /Species/i }));
    fireEvent.click(screen.getByText('Feline'));

    expect(onSelect).toHaveBeenCalledWith({ label: 'Feline', value: 'cat' });
    expect(screen.getByText('Feline')).toBeInTheDocument();
  });

  it('preselects default option', () => {
    render(
      <LabelDropdown
        placeholder="Species"
        options={options}
        defaultOption="dog"
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByText('Canine')).toBeInTheDocument();
  });

  it('has no axe accessibility violations', async () => {
    const { container } = render(
      <LabelDropdown placeholder="Species" options={options} onSelect={jest.fn()} />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
