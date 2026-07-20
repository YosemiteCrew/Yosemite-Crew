import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import VisitTimer from '@/app/features/appointments/pages/AppointmentWorkspace/components/VisitTimer';
import { formatElapsed } from '@/app/lib/appointmentWorkspace';

const NOW = new Date('2026-07-10T10:00:00.000Z').getTime();

describe('formatElapsed', () => {
  it('formats a positive span as HH:MM:SS with padding', () => {
    expect(formatElapsed(0)).toBe('00:00:00');
    expect(formatElapsed(1000)).toBe('00:00:01');
    expect(formatElapsed(65 * 1000)).toBe('00:01:05');
    expect(formatElapsed((3600 + 120 + 7) * 1000)).toBe('01:02:07');
  });

  it('clamps negative spans to zero', () => {
    expect(formatElapsed(-5000)).toBe('00:00:00');
  });
});

describe('VisitTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });
  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders a resting "Not started" state when no start is available', () => {
    render(<VisitTimer />);
    const pill = screen.getByTestId('visit-timer');
    expect(pill).toHaveAttribute('data-state', 'idle');
    expect(pill).toHaveTextContent('Not started');
  });

  it('treats a future start as not started', () => {
    render(<VisitTimer startAt={new Date(NOW + 60_000)} />);
    expect(screen.getByTestId('visit-timer')).toHaveAttribute('data-state', 'idle');
  });

  it('ignores an unparseable start timestamp', () => {
    render(<VisitTimer startAt="not-a-date" />);
    expect(screen.getByTestId('visit-timer')).toHaveAttribute('data-state', 'idle');
  });

  it('counts up in the running state and ticks every second', () => {
    render(<VisitTimer startAt={new Date(NOW - 62_000)} />);
    const pill = screen.getByTestId('visit-timer');
    expect(pill).toHaveAttribute('data-state', 'running');
    expect(pill).toHaveTextContent('In room 00:01:02');
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('visit-timer')).toHaveTextContent('In room 00:01:03');
  });

  it('turns amber once the booked slot is exceeded', () => {
    render(<VisitTimer startAt={new Date(NOW - 3600_000)} bookedEndAt={new Date(NOW - 60_000)} />);
    const pill = screen.getByTestId('visit-timer');
    expect(pill).toHaveAttribute('data-state', 'over');
    expect(pill).toHaveTextContent('Over booked slot · 01:00:00');
  });

  it('stays running when still within the booked slot', () => {
    render(<VisitTimer startAt={new Date(NOW - 60_000)} bookedEndAt={new Date(NOW + 3600_000)} />);
    expect(screen.getByTestId('visit-timer')).toHaveAttribute('data-state', 'running');
  });

  describe('phone variant', () => {
    it('rests with a compact "Not started" pill when no start is available', () => {
      render(<VisitTimer variant="phone" />);
      const pill = screen.getByTestId('visit-timer');
      expect(pill).toHaveAttribute('data-state', 'idle');
      expect(pill).toHaveTextContent('Not started');
    });

    it('shows the running elapsed as MM:SS under an hour, without the "In room" prefix', () => {
      render(<VisitTimer variant="phone" startAt={new Date(NOW - 62_000)} />);
      const pill = screen.getByTestId('visit-timer');
      expect(pill).toHaveAttribute('data-state', 'running');
      expect(pill).toHaveTextContent('01:02');
      expect(pill).not.toHaveTextContent('In room');
    });

    it('keeps the HH:MM:SS form once the elapsed passes an hour', () => {
      render(<VisitTimer variant="phone" startAt={new Date(NOW - (3600 + 62) * 1000)} />);
      expect(screen.getByTestId('visit-timer')).toHaveTextContent('01:01:02');
    });

    it('renders a compact over-booked pill past the booked slot', () => {
      render(
        <VisitTimer
          variant="phone"
          startAt={new Date(NOW - 3600_000)}
          bookedEndAt={new Date(NOW - 60_000)}
        />
      );
      const pill = screen.getByTestId('visit-timer');
      expect(pill).toHaveAttribute('data-state', 'over');
      expect(pill).toHaveTextContent('01:00:00');
      expect(pill).not.toHaveTextContent('Over booked slot');
    });
  });
});
