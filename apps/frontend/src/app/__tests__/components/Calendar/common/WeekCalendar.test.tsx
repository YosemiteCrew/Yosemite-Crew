import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import WeekCalendar from '@/app/features/appointments/components/Calendar/common/WeekCalendar';

const mockGetWeekDays = jest.fn();
const mockGetPrevWeek = jest.fn();
const mockGetNextWeek = jest.fn();
const mockEventsForDayHour = jest.fn();

jest.mock('@/app/features/appointments/components/Calendar/weekHelpers', () => ({
  getWeekDays: (...args: any[]) => mockGetWeekDays(...args),
  getPrevWeek: (...args: any[]) => mockGetPrevWeek(...args),
  getNextWeek: (...args: any[]) => mockGetNextWeek(...args),
  eventsForDayHour: (...args: any[]) => mockEventsForDayHour(...args),
  HOURS_IN_DAY: 2,
}));

const mockComputeUnavailableSegments = jest.fn<any, any[]>(() => []);

jest.mock('@/app/features/appointments/components/Calendar/helpers', () => ({
  DEFAULT_CALENDAR_FOCUS_MINUTES: 540,
  EVENT_VERTICAL_GAP_PX: 2,
  MINUTES_PER_STEP: 60,
  PIXELS_PER_STEP: 60,
  computeUnavailableSegments: (...args: any[]) => mockComputeUnavailableSegments(...args),
  getFirstRelevantTimedEventStart: jest.fn(() => null),
  getNowTopPxForHourRange: jest.fn((_: Date, __: number, ___: number, height: number) => height),
  getTopPxForMinutes: jest.fn((minutes: number, hourHeight: number, gap: number, offset = 0) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours * (hourHeight + gap) + (mins / 60) * hourHeight + offset;
  }),
  isSameDay: () => false,
  isAllDayForDate: jest.fn((event: any) => event.id === 'all-day'),
  minutesSinceStartOfDay: jest.fn((date: Date) => date.getHours() * 60 + date.getMinutes()),
  nextDay: jest.fn((date: Date) => new Date(date.getTime() + 24 * 60 * 60 * 1000)),
  scrollContainerToTarget: jest.fn(),
}));

const slotSpy = jest.fn();

jest.mock('@/app/features/appointments/components/Calendar/common/Slot', () => (props: any) => {
  slotSpy(props);
  return <div data-testid="slot" />;
});

jest.mock('@/app/ui/tables/Appointments', () => ({
  getStatusStyle: jest.fn(() => ({ backgroundColor: 'pink', color: 'white' })),
}));

jest.mock('@/app/ui/primitives/Icons/Back', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      PrevWeek
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Icons/Next', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      NextWeek
    </button>
  ),
}));

describe('WeekCalendar (Appointments)', () => {
  const handleViewAppointment = jest.fn();
  const handleRescheduleAppointment = jest.fn();
  const weekStart = new Date('2025-01-06T00:00:00Z');
  const days = [
    new Date('2025-01-06T00:00:00Z'),
    new Date('2025-01-07T00:00:00Z'),
    new Date('2025-01-08T00:00:00Z'),
  ];

  const events: any[] = [
    {
      id: 'all-day',
      status: 'completed',
      startTime: new Date('2025-01-07T00:00:00Z'),
      companion: { name: 'Milo', parent: { name: 'Sam' } },
      concern: 'Checkup',
    },
    {
      id: 'timed',
      status: 'in_progress',
      startTime: new Date('2025-01-06T09:00:00Z'),
      companion: { name: 'Rex', parent: { name: 'Alex' } },
      concern: 'Grooming',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetWeekDays.mockReturnValue(days);
    mockEventsForDayHour.mockReturnValue([events[1]]);
    mockGetPrevWeek.mockReturnValue(new Date('2024-12-30T00:00:00Z'));
    mockGetNextWeek.mockReturnValue(new Date('2025-01-13T00:00:00Z'));
    mockComputeUnavailableSegments.mockReturnValue([]);
  });

  it('shades unavailable hour segments from the visible availability intervals', () => {
    const getVisibleAvailabilityIntervals = jest.fn(() => [{ startMinute: 30, endMinute: 120 }]);
    mockComputeUnavailableSegments.mockReturnValue([{ startMinute: 0, endMinute: 30 }]);

    const { container } = render(
      <WeekCalendar
        events={events}
        handleViewAppointment={handleViewAppointment}
        weekStart={weekStart}
        handleRescheduleAppointment={handleRescheduleAppointment}
        canEditAppointments
        getVisibleAvailabilityIntervals={getVisibleAvailabilityIntervals}
        availabilityLoaded
      />
    );

    // One dim overlay per day for hour 0 (the segment ends before hour 1 starts).
    const overlays = container.querySelectorAll('[style*="calendar-dim-overlay"]');
    expect(overlays).toHaveLength(days.length);
    expect((overlays[0] as HTMLElement).style.top).toBe('0%');
    expect((overlays[0] as HTMLElement).style.height).toBe('50%');
    expect(getVisibleAvailabilityIntervals).toHaveBeenCalled();
    expect(mockComputeUnavailableSegments).toHaveBeenCalled();
  });

  it('renders day headers and all-day events', () => {
    render(
      <WeekCalendar
        events={events}
        handleViewAppointment={handleViewAppointment}
        weekStart={weekStart}
        handleRescheduleAppointment={handleRescheduleAppointment}
        canEditAppointments
      />
    );

    expect(
      screen.getByRole('region', {
        name: 'Appointments week calendar starting January 6, 2025',
      })
    ).toBeInTheDocument();
    expect(screen.getByText('All-day')).toBeInTheDocument();
    const allDayButton = screen.getAllByText(/Milo/)[0].closest('button');
    expect(allDayButton).toHaveAccessibleName('All-day appointment for Milo. Checkup');
    fireEvent.click(allDayButton!);

    expect(handleViewAppointment).toHaveBeenCalledWith(events[0]);
    expect(slotSpy).toHaveBeenCalled();
  });

  it('renders bare day headers with no in-grid week arrows', () => {
    // The frame's week grid is `gutter + 7 day columns` with no arrow columns —
    // week navigation is owned by the header toolbar's date-nav pill (covered in
    // Header.test.tsx). The grid header carries only the day label and date.
    render(
      <WeekCalendar
        events={events}
        handleViewAppointment={handleViewAppointment}
        weekStart={weekStart}
        handleRescheduleAppointment={handleRescheduleAppointment}
        canEditAppointments
      />
    );

    expect(screen.queryByText('PrevWeek')).not.toBeInTheDocument();
    expect(screen.queryByText('NextWeek')).not.toBeInTheDocument();
  });

  it('styles the day header strip with the frame typography and tints today', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-07T10:00:00Z'));

    const { container } = render(
      <WeekCalendar
        events={events}
        handleViewAppointment={handleViewAppointment}
        weekStart={weekStart}
        handleRescheduleAppointment={handleRescheduleAppointment}
        canEditAppointments
      />
    );

    // The day strip takes the shared header recipe instead of restating
    // 9.5px/700/0.08em, which is what let it drift from the table header.
    const band = container.querySelector('.yc-table-head');
    expect(band).toBeInTheDocument();
    expect(band).toHaveClass('yc-table-head--flush', 'yc-table-head--static');
    // Scoped to the band: the "All-day" label below is a ROW-axis label, like
    // the time gutter, and keeps its own denser type by design.
    expect(band?.querySelector('.tracking-\\[0\\.08em\\]')).toBeNull();

    // Today's date drops into a 24px --blue disc, and its header cell takes
    // --nav-active-bg. Days mock to 6/7/8 Jan, so the 7th is today.
    const todayDisc = Array.from(container.querySelectorAll('div')).find(
      (el) =>
        el.className.includes('size-6') &&
        el.getAttribute('style')?.includes('background-color: var(--blue-strong)')
    );
    expect(todayDisc).toHaveTextContent('7');
    expect(todayDisc?.parentElement?.getAttribute('style')).toContain(
      'background-color: var(--nav-active-bg)'
    );

    jest.useRealTimers();
  });

  it('shows now indicator when current time is within week', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-08T10:00:00Z'));

    const { container } = render(
      <WeekCalendar
        events={events}
        handleViewAppointment={handleViewAppointment}
        weekStart={weekStart}
        handleRescheduleAppointment={handleRescheduleAppointment}
        canEditAppointments
      />
    );

    // The now-line follows the frame's --blue 2px rule, not the old red-500.
    const nowLine = Array.from(container.querySelectorAll('div')).find((el) =>
      el.getAttribute('style')?.includes('border-top-color: var(--blue)')
    );
    expect(nowLine).toBeInTheDocument();

    jest.useRealTimers();
  });

  it('drives day columns and gutters from the responsive custom properties', () => {
    const { container } = render(
      <WeekCalendar
        events={events}
        handleViewAppointment={handleViewAppointment}
        weekStart={weekStart}
        handleRescheduleAppointment={handleRescheduleAppointment}
        canEditAppointments
      />
    );

    // The root owns the custom properties the media query overrides, and carries
    // the zoom mode that selects the minimum day-column width.
    const root = container.querySelector('.yc-week-grid');
    expect(root).toHaveAttribute('data-zoom-mode', 'in');

    // Every horizontal band uses the shared shell, so the gutter is defined once.
    expect(container.querySelectorAll('.yc-week-grid__shell').length).toBeGreaterThan(0);
    expect(container.querySelector('.grid-cols-\\[64px_minmax\\(0\\,1fr\\)_64px\\]')).toBeNull();

    // Day columns must stay var-driven; a hardcoded px minimum would re-introduce
    // the sideways scroll the tablet band exists to remove.
    const dayTrack = container.querySelector<HTMLElement>('[style*="--yc-week-day-min"]');
    expect(dayTrack).not.toBeNull();
    expect(dayTrack!.style.gridTemplateColumns).toBe(
      `repeat(${days.length}, minmax(var(--yc-week-day-min), 1fr))`
    );
    expect(dayTrack!.style.width).toBe(`max(100%, calc(${days.length} * var(--yc-week-day-min)))`);

    // The hour gutter shrinks with the grid, so the label must be targetable.
    expect(container.querySelector('.yc-week-grid__hour-label')).not.toBeNull();
  });

  it('marks the zoom mode on the root so the out mode narrows day columns', () => {
    const { container } = render(
      <WeekCalendar
        events={events}
        zoomMode="out"
        handleViewAppointment={handleViewAppointment}
        weekStart={weekStart}
        handleRescheduleAppointment={handleRescheduleAppointment}
        canEditAppointments
      />
    );

    expect(container.querySelector('.yc-week-grid')).toHaveAttribute('data-zoom-mode', 'out');
  });

  it('precomputes slot events once per visible day and hour', () => {
    render(
      <WeekCalendar
        events={events}
        handleViewAppointment={handleViewAppointment}
        weekStart={weekStart}
        handleRescheduleAppointment={handleRescheduleAppointment}
        canEditAppointments
      />
    );

    const uniqueDayHourCalls = new Set(
      mockEventsForDayHour.mock.calls.map(([, day, hour]) => `${day.toISOString()}-${hour}`)
    );

    expect(mockEventsForDayHour).toHaveBeenCalledTimes(uniqueDayHourCalls.size);
    expect(uniqueDayHourCalls.size).toBeGreaterThan(0);
  });
});
