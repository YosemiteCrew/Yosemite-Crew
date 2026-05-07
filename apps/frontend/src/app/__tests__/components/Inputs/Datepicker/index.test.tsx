import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

import Datepicker from '@/app/ui/inputs/Datepicker';

jest.mock('react-datepicker', () => {
  return {
    __esModule: true,
    default: ({ customInput, selected, onChange }: any) => (
      <div>
        {React.cloneElement(customInput, {
          value: selected ? 'Jan 15, 2025' : '',
        })}
        <button type="button" onClick={() => onChange(new Date('2026-01-01T00:00:00.000Z'))}>
          pick-date
        </button>
      </div>
    ),
  };
});

expect.extend(toHaveNoViolations);

describe('Datepicker (index)', () => {
  it('selects a date in input mode', () => {
    const setCurrentDate = jest.fn();

    render(
      <Datepicker
        currentDate={new Date('2025-01-15T00:00:00.000Z')}
        setCurrentDate={setCurrentDate}
        placeholder="Select date"
        type="input"
      />
    );

    fireEvent.click(screen.getByText('pick-date'));

    expect(setCurrentDate).toHaveBeenCalledWith(new Date('2026-01-01T00:00:00.000Z'));
  });

  it('renders icon trigger mode', () => {
    render(
      <Datepicker
        currentDate={new Date('2025-01-01T00:00:00.000Z')}
        setCurrentDate={jest.fn()}
        placeholder="Select date"
      />
    );

    expect(screen.getByLabelText('Toggle calendar')).toBeInTheDocument();
  });

  it('wires validation helper text to the trigger', () => {
    render(
      <Datepicker
        currentDate={null}
        setCurrentDate={jest.fn()}
        placeholder="Select date"
        type="input"
        error="Date is required"
      />
    );

    const trigger = screen.getByRole('button', { name: 'Select date, toggle calendar' });
    const error = screen.getByRole('alert');

    expect(trigger).toHaveAttribute('aria-describedby', error.id);
    expect(error).toHaveTextContent('Date is required');
  });

  it('has no axe accessibility violations in input mode', async () => {
    const { container } = render(
      <Datepicker
        currentDate={new Date('2025-01-15T00:00:00.000Z')}
        setCurrentDate={jest.fn()}
        placeholder="Select date"
        type="input"
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe accessibility violations in error state', async () => {
    const { container } = render(
      <Datepicker
        currentDate={null}
        setCurrentDate={jest.fn()}
        placeholder="Select date"
        type="input"
        error="Date is required"
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe accessibility violations in icon trigger mode', async () => {
    const { container } = render(
      <Datepicker
        currentDate={new Date('2025-01-01T00:00:00.000Z')}
        setCurrentDate={jest.fn()}
        placeholder="Select date"
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
