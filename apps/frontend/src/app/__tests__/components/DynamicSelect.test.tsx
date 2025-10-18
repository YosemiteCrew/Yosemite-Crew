import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import DynamicSelect, { Option } from '@/app/components/DynamicSelect/DynamicSelect';

const mockOptions: Option[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
];

describe('DynamicSelect Component', () => {
  const user = userEvent.setup();
  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('should render correctly with a placeholder when no value is selected', () => {
    render(
      <DynamicSelect
        options={mockOptions}
        value=""
        onChange={mockOnChange}
        inname="fruit-selector"
        placeholder="Select a fruit"
      />
    );

    expect(screen.getByText('Select a fruit')).toBeInTheDocument();
  });

  it('should display the label of the currently selected value', () => {
    render(
      <DynamicSelect
        options={mockOptions}
        value="banana"
        onChange={mockOnChange}
        inname="fruit-selector"
      />
    );

    expect(screen.getByText('Banana')).toBeInTheDocument();
  });

  it('should display the default placeholder if the value does not match any option', () => {
    render(
      <DynamicSelect
        options={mockOptions}
        value="grape"
        onChange={mockOnChange}
        inname="fruit-selector"
      />
    );

    expect(screen.getByText('Select an option')).toBeInTheDocument();
  });

  it('should open the dropdown and call onChange with the correct value when an item is clicked', async () => {
    render(
      <DynamicSelect
        options={mockOptions}
        value=""
        onChange={mockOnChange}
        inname="fruit-selector"
        placeholder="Select a fruit"
      />
    );

    const dropdownToggle = screen.getByText('Select a fruit');
    await user.click(dropdownToggle);

    const cherryOption = await screen.findByText('Cherry');
    await user.click(cherryOption);

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith('cherry');
  });

  it('should display a "No options available" message when options array is empty', async () => {
    render(
      <DynamicSelect
        options={[]}
        value=""
        onChange={mockOnChange}
        inname="fruit-selector"
      />
    );

    const dropdownToggle = screen.getByText('Select an option');
    await user.click(dropdownToggle);

    const noOptionsMessage = await screen.findByText('No options available');
    expect(noOptionsMessage).toBeInTheDocument();
  });

  it('should display an error message when the error prop is provided', () => {
    const errorMessage = 'This field is required.';
    render(
      <DynamicSelect
        options={mockOptions}
        value=""
        onChange={mockOnChange}
        inname="fruit-selector"
        error={errorMessage}
      />
    );

    const errorText = screen.getByText(errorMessage);
    expect(errorText).toBeInTheDocument();
    expect(errorText).toHaveClass('text-danger');
  });

  it('should call onChange with an empty string when the placeholder item is selected', async () => {
    render(
      <DynamicSelect
        options={mockOptions}
        value="apple"
        onChange={mockOnChange}
        inname="fruit-selector"
        placeholder="Select a fruit"
      />
    );

    await user.click(screen.getByText('Apple'));

    const placeholderOption = await screen.findByRole('button', { name: 'Select a fruit' });
    await user.click(placeholderOption);

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith('');
  });
});