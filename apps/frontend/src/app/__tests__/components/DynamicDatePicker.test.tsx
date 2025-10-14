import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import DynamicDatePicker from '@/app/components/DynamicDatePicker/DynamicDatePicker';

const mockOnDateChange = jest.fn();

describe('DynamicDatePicker', () => {
  beforeEach(() => {
    mockOnDateChange.mockClear();
  });

  it('should render with a placeholder and a calendar icon', () => {
    render(
      <DynamicDatePicker
        placeholder="Select your birth date"
        onDateChange={mockOnDateChange}
      />,
    );

    expect(screen.getByPlaceholderText('Select your birth date')).toBeInTheDocument();

  });

  it('should display the initial date provided via the value prop', () => {
    render(
      <DynamicDatePicker
        placeholder="Select a date"
        onDateChange={mockOnDateChange}
        value="2025-10-26"
      />,
    );

    expect(screen.getByDisplayValue('2025-10-26')).toBeInTheDocument();
  });

  it('should call onDateChange with the formatted date string when a date is selected', async () => {
    render(
      <DynamicDatePicker
        placeholder="Select a date"
        onDateChange={mockOnDateChange}
        value="2025-10-01"
      />,
    );

    const dateInput = screen.getByDisplayValue('2025-10-01');

    fireEvent.click(dateInput);

    const dayToSelect = await screen.findByText('15');
    fireEvent.click(dayToSelect);

    expect(mockOnDateChange).toHaveBeenCalledTimes(1);
    expect(mockOnDateChange).toHaveBeenCalledWith('2025-10-15');
  });

  it('should call onDateChange with null when the date is cleared', () => {
    render(
      <DynamicDatePicker
        placeholder="Select a date"
        onDateChange={mockOnDateChange}
        value="2025-10-26"
      />,
    );

    const dateInput = screen.getByDisplayValue('2025-10-26');

    fireEvent.change(dateInput, { target: { value: '' } });

    expect(mockOnDateChange).toHaveBeenCalledTimes(1);
    expect(mockOnDateChange).toHaveBeenCalledWith(null);
  });

  it('should update the displayed date when the value prop changes', () => {
    const { rerender } = render(
      <DynamicDatePicker
        placeholder="Select a date"
        onDateChange={mockOnDateChange}
        value="2025-10-26"
      />,
    );

    expect(screen.getByDisplayValue('2025-10-26')).toBeInTheDocument();

    rerender(
      <DynamicDatePicker
        placeholder="Select a date"
        onDateChange={mockOnDateChange}
        value="2025-11-10"
      />,
    );

    expect(screen.getByDisplayValue('2025-11-10')).toBeInTheDocument();
  });

  it('should disable dates outside the minDate and maxDate range', async () => {
    render(
      <DynamicDatePicker
        placeholder="Select a date"
        onDateChange={mockOnDateChange}
        value="2025-10-15"
        minDate={new Date('2025-10-10')}
        maxDate={new Date('2025-10-20')}
      />,
    );

    fireEvent.click(screen.getByDisplayValue('2025-10-15'));

    const disabledDay = await screen.findByText('9');
    expect(disabledDay).toHaveAttribute('aria-disabled', 'true');

    const disabledDay2 = await screen.findByText('21');
    expect(disabledDay2).toHaveAttribute('aria-disabled', 'true');

    const enabledDay = await screen.findByText('15');
    expect(enabledDay).not.toHaveAttribute('aria-disabled', 'true');
  });
});