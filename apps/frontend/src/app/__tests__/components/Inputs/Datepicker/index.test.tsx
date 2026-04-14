import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

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
});
