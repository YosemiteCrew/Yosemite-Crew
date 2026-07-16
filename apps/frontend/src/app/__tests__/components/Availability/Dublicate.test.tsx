import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Dublicate from '@/app/features/appointments/components/Availability/Dublicate';
import {
  AvailabilityState,
  daysOfWeek,
} from '@/app/features/appointments/components/Availability/utils';

jest.mock('react-icons/io5', () => ({
  IoCopy: ({ onClick, ...rest }: any) => (
    <button type="button" onClick={onClick} {...rest}>
      copy
    </button>
  ),
}));

const buildAvailability = (): AvailabilityState =>
  daysOfWeek.reduce<AvailabilityState>((acc, day) => {
    acc[day] = {
      enabled: day === 'Monday',
      intervals: [{ start: '09:00', end: '10:00' }],
    };
    return acc;
  }, {} as AvailabilityState);

const Wrapper = () => {
  const [availability, setAvailability] = useState(buildAvailability());
  const tuesday = availability.Tuesday;
  return (
    <>
      <Dublicate setAvailability={setAvailability} day="Monday" />
      <div data-testid="tuesday-enabled">{String(tuesday.enabled)}</div>
      <div data-testid="tuesday-intervals">
        {tuesday.intervals.map((i) => `${i.start}-${i.end}`).join(',')}
      </div>
    </>
  );
};

describe('Dublicate', () => {
  it('copies intervals to selected days', () => {
    render(<Wrapper />);

    fireEvent.click(screen.getByText('copy'));
    const checkbox = screen.getByLabelText('Copy availability to Tuesday') as HTMLInputElement;
    fireEvent.click(checkbox);

    fireEvent.click(screen.getByText('Apply'));

    expect(screen.getByTestId('tuesday-enabled')).toHaveTextContent('true');
    expect(screen.getByTestId('tuesday-intervals')).toHaveTextContent('09:00-10:00');
  });

  // The day name is most of the row's hit area. It used to sit inside a handler-less
  // <button>, so clicking it did nothing; it is now a <label> bound to the checkbox.
  it('selects a day when its name is clicked, not just the checkbox', () => {
    render(<Wrapper />);

    fireEvent.click(screen.getByText('copy'));
    fireEvent.click(screen.getByText('Tuesday'));

    expect(screen.getByLabelText('Copy availability to Tuesday')).toBeChecked();

    // The real effect: applying now copies Monday's intervals onto Tuesday.
    fireEvent.click(screen.getByText('Apply'));
    expect(screen.getByTestId('tuesday-enabled')).toHaveTextContent('true');
    expect(screen.getByTestId('tuesday-intervals')).toHaveTextContent('09:00-10:00');
  });

  it('gives each day row a label bound to a unique checkbox id', () => {
    render(<Wrapper />);
    fireEvent.click(screen.getByText('copy'));

    const ids = daysOfWeek.map(
      (day) => (screen.getByLabelText(`Copy availability to ${day}`) as HTMLInputElement).id
    );

    expect(new Set(ids).size).toBe(daysOfWeek.length);
    expect(ids.every(Boolean)).toBe(true);
  });

  it('does not select the source day, whose row is disabled', () => {
    render(<Wrapper />);

    fireEvent.click(screen.getByText('copy'));
    const monday = screen.getByLabelText('Copy availability to Monday') as HTMLInputElement;
    expect(monday).toBeDisabled();

    fireEvent.click(screen.getByText('Monday'));
    expect(monday).not.toBeChecked();
  });

  it('closes without changes when no target selected', () => {
    render(<Wrapper />);

    fireEvent.click(screen.getByText('copy'));
    fireEvent.click(screen.getByText('Apply'));

    expect(screen.getByTestId('tuesday-enabled')).toHaveTextContent('false');
    expect(screen.getByTestId('tuesday-intervals')).toHaveTextContent('09:00-10:00');
  });
});
