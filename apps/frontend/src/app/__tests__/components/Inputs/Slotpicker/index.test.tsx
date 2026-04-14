import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
    expect(selectedBtn).toHaveClass('text-[#247AED]');
    expect(otherBtn).not.toHaveClass('text-[#247AED]');
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
    expect(todayButton).toHaveClass('border-[#247AED]!');
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
    expect(screen.getByText('Formatted 10:00')).toHaveClass('text-[#247AED]');
    expect(screen.getByText('Formatted 11:00')).not.toHaveClass('text-[#247AED]');
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
});
