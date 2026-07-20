import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import Availability from '@/app/features/appointments/components/Availability/Availability';
import {
  daysOfWeek,
  DEFAULT_INTERVAL,
  AvailabilityState,
} from '@/app/features/appointments/components/Availability/utils';

jest.mock('@/app/features/appointments/components/Availability/TimeSlot', () => ({
  __esModule: true,
  default: ({ day, field, intervalIndex }: any) => (
    <div data-testid={`slot-${day}-${field}-${intervalIndex}`} />
  ),
}));

jest.mock('@/app/features/appointments/components/Availability/Dublicate', () => ({
  __esModule: true,
  default: ({ day }: any) => <div data-testid={`duplicate-${day}`} />,
}));

jest.mock(
  'react-icons/io5',
  () =>
    new Proxy(
      { __esModule: true },
      {
        get: (_t, name) => {
          if (name === '__esModule') return true;
          const Icon =
            (_t as any)[String(name)] ||
            ((_t as any)[String(name)] = (props: any) => (
              <span data-testid={String(name)} onClick={props.onClick} />
            ));
          return Icon;
        },
      }
    )
);

const buildAvailability = (): AvailabilityState =>
  daysOfWeek.reduce<AvailabilityState>((acc, day) => {
    acc[day] = {
      enabled: day === 'Monday',
      intervals: [{ ...DEFAULT_INTERVAL }],
    };
    return acc;
  }, {} as AvailabilityState);

const Wrapper = () => {
  const [availability, setAvailability] = useState(buildAvailability());
  return <Availability availability={availability} setAvailability={setAvailability} />;
};

describe('Availability', () => {
  it('toggles a day on switch click', () => {
    render(<Wrapper />);

    const mondayRow = screen.getByText('Monday').closest('div');
    const checkbox = within(mondayRow!).getByRole('checkbox');

    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('shows a Day off label for disabled days', () => {
    render(<Wrapper />);

    // Monday is the only enabled day, so every other weekday reads "Day off".
    expect(screen.getAllByText('Day off')).toHaveLength(daysOfWeek.length - 1);
  });

  it('adds and removes intervals', () => {
    render(<Wrapper />);

    expect(screen.getAllByTestId(/slot-Monday/)).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Add range for Monday' }));
    expect(screen.getAllByTestId(/slot-Monday/)).toHaveLength(4);

    fireEvent.click(screen.getByRole('button', { name: 'Remove range 2 for Monday' }));
    expect(screen.getAllByTestId(/slot-Monday/)).toHaveLength(2);
  });

  it('renders duplicate controls for enabled day', () => {
    render(<Wrapper />);

    expect(screen.getByTestId('duplicate-Monday')).toBeInTheDocument();
    expect(screen.queryByTestId('duplicate-Tuesday')).not.toBeInTheDocument();
  });
});
