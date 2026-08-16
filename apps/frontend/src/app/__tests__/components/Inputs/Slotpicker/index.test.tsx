import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';
import Slotpicker from '@/app/ui/inputs/Slotpicker';
import { Slot } from '@/app/features/appointments/types/appointments';

jest.mock('@/app/features/appointments/components/Availability/utils', () => ({
  formatUtcTimeToLocalLabel: (time: string) => `Formatted ${time}`,
}));

jest.mock('react-icons/gr', () => ({
  GrNext: ({ className }: any) => <span className={className}>Next</span>,
  GrPrevious: ({ className }: any) => <span className={className}>Prev</span>,
}));

describe('Slotpicker Component', () => {
  const mockSetSelectedDate = jest.fn();
  const mockSetSelectedSlot = jest.fn();

  // System time: Wednesday Apr 2, 2025
  const baseDate = new Date(2025, 3, 2, 12, 0, 0); // Apr 2 2025

  const mockTimeSlots: Slot[] = [
    { startTime: '10:00', endTime: '10:30', vetIds: [] },
    { startTime: '11:00', endTime: '11:30', vetIds: [] },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(baseDate);
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 200,
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get: () => 1000,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders month + year header', () => {
    render(
      <Slotpicker
        selectedDate={baseDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={[]}
      />
    );
    expect(screen.getByText('April 2025')).toBeInTheDocument();
  });

  it('renders all 30 days of April as buttons', () => {
    render(
      <Slotpicker
        selectedDate={baseDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={[]}
      />
    );
    for (let d = 1; d <= 30; d++) {
      expect(screen.getByText(String(d).padStart(2, '0'))).toBeInTheDocument();
    }
  });

  it('highlights the selected date', () => {
    render(
      <Slotpicker
        selectedDate={baseDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={[]}
      />
    );
    const selectedBtn = screen.getByText('02').closest('button');
    const otherBtn = screen.getByText('10').closest('button');
    expect(selectedBtn).toHaveClass('text-blue-text');
    expect(otherBtn).not.toHaveClass('text-blue-text');
  });

  it('shows blue border for the current date when not selected', () => {
    const selectedFutureDate = new Date(2025, 3, 10, 12, 0, 0);
    render(
      <Slotpicker
        selectedDate={selectedFutureDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={[]}
      />
    );
    const todayButton = screen.getByText('02').closest('button');
    expect(todayButton).toHaveClass('border-blue-text!');
  });

  it('past dates have opacity-40 and cursor-not-allowed', () => {
    render(
      <Slotpicker
        selectedDate={baseDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={[]}
      />
    );
    // Apr 1 is past (today is Apr 2)
    const pastBtn = screen.getByText('01').closest('button');
    expect(pastBtn).toHaveClass('opacity-40');
    expect(pastBtn).toHaveClass('cursor-not-allowed');
  });

  it('clicking a past date does NOT call setSelectedDate', () => {
    render(
      <Slotpicker
        selectedDate={baseDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={[]}
      />
    );
    fireEvent.click(screen.getByText('01').closest('button')!);
    expect(mockSetSelectedDate).not.toHaveBeenCalled();
  });

  it('clicking a future date calls setSelectedDate and resets slot', () => {
    render(
      <Slotpicker
        selectedDate={baseDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={mockTimeSlots}
      />
    );
    fireEvent.click(screen.getByText('15').closest('button')!);
    expect(mockSetSelectedDate).toHaveBeenCalledWith(new Date(2025, 3, 15));
    expect(mockSetSelectedSlot).toHaveBeenCalledWith(null);
  });

  it('highlights the selected slot', () => {
    render(
      <Slotpicker
        selectedDate={baseDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={mockTimeSlots[0]}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={mockTimeSlots}
      />
    );
    // The fill token, not the text token: --blue-text lightens to #8fb6f5 in
    // dark, which left this white label at 2.06:1.
    expect(screen.getByText('Formatted 10:00')).toHaveClass(
      'bg-[var(--blue-strong)]',
      'text-white'
    );
    expect(screen.getByText('Formatted 11:00')).not.toHaveClass('bg-[var(--blue-strong)]');
  });

  it('calls setSelectedSlot when a slot is clicked', () => {
    render(
      <Slotpicker
        selectedDate={baseDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={mockTimeSlots}
      />
    );
    fireEvent.click(screen.getByText('Formatted 11:00'));
    expect(mockSetSelectedSlot).toHaveBeenCalledWith(mockTimeSlots[1]);
  });

  it("shows 'No slot available' when timeSlots is empty", () => {
    render(
      <Slotpicker
        selectedDate={baseDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={[]}
      />
    );
    expect(screen.getByText('No slot available')).toBeInTheDocument();
  });

  it('prev-month button has cursor-not-allowed on current month', () => {
    render(
      <Slotpicker
        selectedDate={baseDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={[]}
      />
    );
    expect(screen.getByRole('button', { name: 'Previous month' })).toHaveClass(
      'cursor-not-allowed'
    );
  });

  it('scrolls date strip right with arrow control', () => {
    render(
      <Slotpicker
        selectedDate={baseDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={[]}
      />
    );

    const dateStrip = screen.getByText('02').closest('button')?.parentElement as HTMLDivElement;
    const scrollByMock = jest.fn();
    Object.defineProperty(dateStrip, 'scrollBy', {
      value: scrollByMock,
      writable: true,
      configurable: true,
    });

    fireEvent.resize(window);
    fireEvent.click(screen.getByRole('button', { name: 'Scroll dates right' }));
    expect(scrollByMock).toHaveBeenCalledWith({
      left: 180,
      behavior: 'smooth',
    });
  });

  it('scrolls date strip left with arrow control', () => {
    render(
      <Slotpicker
        selectedDate={baseDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={[]}
      />
    );

    const dateStrip = screen.getByText('02').closest('button')?.parentElement as HTMLDivElement;
    const scrollByMock = jest.fn();
    Object.defineProperty(dateStrip, 'scrollBy', {
      value: scrollByMock,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(dateStrip, 'scrollLeft', {
      value: 240,
      writable: true,
      configurable: true,
    });
    fireEvent.scroll(dateStrip);

    fireEvent.click(screen.getByRole('button', { name: 'Scroll dates left' }));
    expect(scrollByMock).toHaveBeenCalledWith({
      left: -180,
      behavior: 'smooth',
    });
  });

  it('navigates to next month', () => {
    render(
      <Slotpicker
        selectedDate={baseDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={[]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('May 2025')).toBeInTheDocument();
    // May has 31 days
    expect(screen.getByText('31')).toBeInTheDocument();
  });

  it('navigates to previous month when not on current month', () => {
    const mayDate = new Date(2025, 4, 10, 12, 0, 0);
    render(
      <Slotpicker
        selectedDate={mayDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={[]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('April 2025')).toBeInTheDocument();
  });

  it('wraps year on next month from December', () => {
    const decDate = new Date(2025, 11, 15, 12, 0, 0);
    render(
      <Slotpicker
        selectedDate={decDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={[]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('January 2026')).toBeInTheDocument();
  });

  it('wraps year backwards on previous month from January', () => {
    const janDate = new Date(2026, 0, 15, 12, 0, 0);
    render(
      <Slotpicker
        selectedDate={janDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={[]}
      />
    );
    expect(screen.getByText('January 2026')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('December 2025')).toBeInTheDocument();
  });

  it('follows the selected date into a different month and year', () => {
    const { rerender } = render(
      <Slotpicker
        selectedDate={baseDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={[]}
      />
    );
    expect(screen.getByText('April 2025')).toBeInTheDocument();

    rerender(
      <Slotpicker
        selectedDate={new Date(2026, 5, 9, 12, 0, 0)}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={[]}
      />
    );

    expect(screen.getByText('June 2026')).toBeInTheDocument();
  });

  it('keeps the view put when the selected date changes within the same month', () => {
    const { rerender } = render(
      <Slotpicker
        selectedDate={baseDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={[]}
      />
    );

    // A new Date instance in the same month/year: the sync block runs but
    // neither view-state setter should fire.
    rerender(
      <Slotpicker
        selectedDate={new Date(2025, 3, 20, 12, 0, 0)}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={[]}
      />
    );

    expect(screen.getByText('April 2025')).toBeInTheDocument();
    expect(screen.getByText('20').closest('button')).toHaveClass('text-blue-text');
  });

  it('follows the selected date into a different month of the same year', () => {
    const { rerender } = render(
      <Slotpicker
        selectedDate={baseDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={[]}
      />
    );

    rerender(
      <Slotpicker
        selectedDate={new Date(2025, 6, 4, 12, 0, 0)}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={[]}
      />
    );

    expect(screen.getByText('July 2025')).toBeInTheDocument();
  });

  it('scrolls the slot list into view shortly after a date is picked', () => {
    const scrollIntoViewMock = globalThis.HTMLElement.prototype.scrollIntoView as jest.Mock;
    scrollIntoViewMock.mockClear();

    render(
      <Slotpicker
        selectedDate={baseDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={mockTimeSlots}
      />
    );

    fireEvent.click(screen.getByText('15').closest('button')!);
    expect(scrollIntoViewMock).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(80);
    });

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });
  });
});
