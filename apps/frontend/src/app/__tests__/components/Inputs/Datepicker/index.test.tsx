import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

import Datepicker from '@/app/ui/inputs/Datepicker';

jest.mock('react-datepicker', () => {
  return {
    __esModule: true,
    default: ({ customInput, selected, onChange, portalId }: any) => (
      <div>
        <span data-testid="datepicker-portal-id">{portalId ?? 'none'}</span>
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

  it('exposes the selected value in the accessible name in input mode', () => {
    render(
      <Datepicker
        currentDate={new Date('2025-01-15T00:00:00.000Z')}
        setCurrentDate={jest.fn()}
        placeholder="Visit date"
        type="input"
        error="Required"
      />
    );

    expect(
      screen.getByRole('button', { name: 'Visit date: Jan 15, 2025, toggle calendar' })
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  it('falls back to a default accessible label when the placeholder is empty', () => {
    render(
      <Datepicker currentDate={null} setCurrentDate={jest.fn()} placeholder="" type="input" />
    );

    expect(screen.getByRole('button', { name: 'Date, toggle calendar' })).toBeInTheDocument();
  });

  it('stays memoised across re-renders with equal props', () => {
    const { rerender } = render(
      <Datepicker
        currentDate={new Date('2025-01-15T00:00:00.000Z')}
        setCurrentDate={jest.fn()}
        placeholder="Visit date"
        type="input"
        minDate={new Date('2025-01-01T00:00:00.000Z')}
        minYear={2000}
        maxYear={2030}
        containerClassName="wrap"
      />
    );

    rerender(
      <Datepicker
        currentDate={new Date('2025-01-15T00:00:00.000Z')}
        setCurrentDate={jest.fn()}
        placeholder="Visit date"
        type="input"
        minDate={new Date('2025-01-01T00:00:00.000Z')}
        minYear={2000}
        maxYear={2030}
        containerClassName="wrap"
      />
    );

    expect(
      screen.getByRole('button', { name: /Visit date: Jan 15, 2025, toggle calendar/ })
    ).toBeInTheDocument();
  });

  it('renders when given a non-finite date value', () => {
    render(
      <Datepicker
        currentDate={new Date('not-a-real-date')}
        setCurrentDate={jest.fn()}
        placeholder="Visit date"
        type="input"
      />
    );

    expect(screen.getByTestId('datepicker-portal-id')).toBeInTheDocument();
  });

  it('re-renders when a compared prop changes', () => {
    const { rerender } = render(
      <Datepicker
        currentDate={new Date('2025-01-15T00:00:00.000Z')}
        setCurrentDate={jest.fn()}
        placeholder="Visit date"
        type="input"
        error="First error"
      />
    );

    rerender(
      <Datepicker
        currentDate={new Date('2025-01-15T00:00:00.000Z')}
        setCurrentDate={jest.fn()}
        placeholder="Visit date"
        type="input"
        error="Second error"
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Second error');
  });

  it('renders the calendar inline when the portal is disabled', () => {
    render(
      <Datepicker
        currentDate={null}
        setCurrentDate={jest.fn()}
        placeholder="Visit date"
        type="input"
        portal={false}
      />
    );

    expect(screen.getByTestId('datepicker-portal-id')).toHaveTextContent('none');
  });

  it('uses the shared portal by default to avoid modal clipping', () => {
    render(
      <Datepicker
        currentDate={null}
        setCurrentDate={jest.fn()}
        placeholder="Select date"
        type="input"
      />
    );

    expect(screen.getByTestId('datepicker-portal-id')).toHaveTextContent('yc-datepicker-portal');
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
