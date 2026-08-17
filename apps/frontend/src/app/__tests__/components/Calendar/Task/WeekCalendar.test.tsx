import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import WeekCalendar from '@/app/features/appointments/components/Calendar/Task/WeekCalendar';
import { Task } from '@/app/features/tasks/types/task';

const mockGetWeekDays = jest.fn();
const mockGetPrevWeek = jest.fn();
const mockGetNextWeek = jest.fn();

jest.mock('@/app/features/appointments/components/Calendar/weekHelpers', () => ({
  getWeekDays: (...args: any[]) => mockGetWeekDays(...args),
  getPrevWeek: (...args: any[]) => mockGetPrevWeek(...args),
  getNextWeek: (...args: any[]) => mockGetNextWeek(...args),
  HOURS_IN_DAY: 1,
}));

jest.mock('@/app/lib/timezone', () => ({
  getHourInPreferredTimeZone: (value: Date) => value.getHours(),
  getMinutesSinceStartOfDayInPreferredTimeZone: (value: Date) =>
    value.getHours() * 60 + value.getMinutes(),
  formatDateInPreferredTimeZone: jest.fn(() => '9:41 AM'),
  isOnPreferredTimeZoneCalendarDay: (value: Date, day: Date) =>
    value.getFullYear() === day.getFullYear() &&
    value.getMonth() === day.getMonth() &&
    value.getDate() === day.getDate(),
}));

const mockEventsForDay = jest.fn();
jest.mock('@/app/features/appointments/components/Calendar/helpers', () => ({
  eventsForDay: (...args: any[]) => mockEventsForDay(...args),
  DEFAULT_CALENDAR_FOCUS_MINUTES: 540,
  EVENT_VERTICAL_GAP_PX: 0,
  MINUTES_PER_STEP: 15,
  PIXELS_PER_STEP: 60,
  getFirstRelevantTimedEventStart: jest.fn(() => null),
  getNowTopPxForHourRange: jest.fn((_: Date, __: number, ___: number, height: number) => height),
  getTopPxForMinutes: jest.fn((minutes: number, height: number) => (minutes / 60) * height),
  minutesSinceStartOfDay: jest.fn(() => 540),
  scrollContainerToTarget: jest.fn(),
}));

const dayLabelsSpy = jest.fn();
jest.mock('@/app/features/appointments/components/Calendar/Task/DayLabels', () => (props: any) => {
  dayLabelsSpy(props);
  return <div data-testid="day-labels" />;
});

const taskSlotSpy = jest.fn();
jest.mock('@/app/features/appointments/components/Calendar/Task/TaskSlot', () => (props: any) => {
  taskSlotSpy(props);
  return <div data-testid="task-slot" />;
});

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

describe('WeekCalendar (Task)', () => {
  const handleViewTask = jest.fn();
  const setWeekStart = jest.fn();
  const setCurrentDate = jest.fn();

  const weekStart = new Date(2025, 0, 6, 12);
  const days = [new Date(2025, 0, 6, 12), new Date(2025, 0, 7, 12)];

  const events: Task[] = [
    {
      name: 'Task A',
      dueAt: new Date(2025, 0, 6, 0),
      status: 'PENDING',
      _id: '',
      audience: 'EMPLOYEE_TASK',
      source: 'CUSTOM',
      category: '',
    } as Task,
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetWeekDays.mockReturnValue(days);
    mockEventsForDay.mockReturnValue(events);
    mockGetPrevWeek.mockReturnValue(new Date(2024, 11, 30, 12));
    mockGetNextWeek.mockReturnValue(new Date(2025, 0, 13, 12));
  });

  it('renders day labels and task slots for each day', () => {
    render(
      <WeekCalendar
        events={events}
        date={weekStart}
        handleViewTask={handleViewTask}
        weekStart={weekStart}
        setWeekStart={setWeekStart}
        setCurrentDate={setCurrentDate}
      />
    );

    expect(screen.getByTestId('day-labels')).toBeInTheDocument();
    expect(dayLabelsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ days, currentDate: weekStart })
    );

    const slots = screen.getAllByTestId('task-slot');
    expect(slots).toHaveLength(days.length);

    expect(taskSlotSpy.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        slotEvents: events,
        handleViewTask,
        height: 180,
        length: days.length - 1,
      })
    );
  });

  it('shows the now indicator with a time label when today is within the week', () => {
    const today = new Date();
    mockGetWeekDays.mockReturnValue([today]);

    render(
      <WeekCalendar
        events={[]}
        date={today}
        handleViewTask={handleViewTask}
        weekStart={today}
        setWeekStart={setWeekStart}
        setCurrentDate={setCurrentDate}
      />
    );

    expect(screen.getByText('9:41 AM')).toBeInTheDocument();
  });

  it('renders no pager of its own - paging belongs to the toolbar', () => {
    // The grid used to carry its own prev/next arrows in two 64px rails either
    // side of the day strip. common/WeekCalendar.css states the intent plainly:
    // "The week grid in the design has no arrow columns at all - prev/next live
    // in the header toolbar's date-nav pill." The right rail also pushed Sunday
    // out of view, so a seven-day week showed six. Header owns paging now and
    // builds its own useCalendarWeekNavigation from the same setters; that
    // behaviour is covered in common/Header.test.tsx.
    render(
      <WeekCalendar
        events={events}
        date={weekStart}
        handleViewTask={handleViewTask}
        weekStart={weekStart}
        setWeekStart={setWeekStart}
        setCurrentDate={setCurrentDate}
      />
    );

    expect(screen.queryByText('PrevWeek')).not.toBeInTheDocument();
    expect(screen.queryByText('NextWeek')).not.toBeInTheDocument();
    expect(setWeekStart).not.toHaveBeenCalled();
  });
});
