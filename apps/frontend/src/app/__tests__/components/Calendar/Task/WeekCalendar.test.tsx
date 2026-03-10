import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import WeekCalendar from "@/app/features/appointments/components/Calendar/Task/WeekCalendar";
import { Task } from "@/app/features/tasks/types/task";

const mockGetWeekDays = jest.fn();
const mockGetPrevWeek = jest.fn();
const mockGetNextWeek = jest.fn();

jest.mock("@/app/features/appointments/components/Calendar/weekHelpers", () => ({
  getWeekDays: (...args: any[]) => mockGetWeekDays(...args),
  getPrevWeek: (...args: any[]) => mockGetPrevWeek(...args),
  getNextWeek: (...args: any[]) => mockGetNextWeek(...args),
  HOURS_IN_DAY: 1,
}));

const mockEventsForDay = jest.fn();
jest.mock("@/app/features/appointments/components/Calendar/helpers", () => ({
  eventsForDay: (...args: any[]) => mockEventsForDay(...args),
  DEFAULT_CALENDAR_FOCUS_MINUTES: 540,
  EVENT_VERTICAL_GAP_PX: 0,
  MINUTES_PER_STEP: 15,
  PIXELS_PER_STEP: 60,
  getFirstRelevantTimedEventStart: jest.fn(() => null),
  getTopPxForMinutes: jest.fn((minutes: number, height: number) => (minutes / 60) * height),
  minutesSinceStartOfDay: jest.fn(() => 540),
  scrollContainerToTarget: jest.fn(),
}));

const dayLabelsSpy = jest.fn();
jest.mock("@/app/features/appointments/components/Calendar/Task/DayLabels", () => (props: any) => {
  dayLabelsSpy(props);
  return <div data-testid="day-labels" />;
});

const taskSlotSpy = jest.fn();
jest.mock("@/app/features/appointments/components/Calendar/Task/TaskSlot", () => (props: any) => {
  taskSlotSpy(props);
  return <div data-testid="task-slot" />;
});

jest.mock("@/app/ui/primitives/Icons/Back", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      PrevWeek
    </button>
  ),
}));

jest.mock("@/app/ui/primitives/Icons/Next", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      NextWeek
    </button>
  ),
}));

describe("WeekCalendar (Task)", () => {
  const handleViewTask = jest.fn();
  const setWeekStart = jest.fn();
  const setCurrentDate = jest.fn();

  const weekStart = new Date(2025, 0, 6, 12);
  const days = [new Date(2025, 0, 6, 12), new Date(2025, 0, 7, 12)];

  const events: Task[] = [
    {
      name: "Task A",
      dueAt: new Date(2025, 0, 6, 0),
      status: "PENDING",
      _id: "",
      audience: "EMPLOYEE_TASK",
      source: "CUSTOM",
      category: "",
    } as Task,
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetWeekDays.mockReturnValue(days);
    mockEventsForDay.mockReturnValue(events);
    mockGetPrevWeek.mockReturnValue(new Date(2024, 11, 30, 12));
    mockGetNextWeek.mockReturnValue(new Date(2025, 0, 13, 12));
  });

  it("renders day labels and task slots for each day", () => {
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

    expect(screen.getByTestId("day-labels")).toBeInTheDocument();
    expect(dayLabelsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ days, currentDate: weekStart })
    );

    const slots = screen.getAllByTestId("task-slot");
    expect(slots).toHaveLength(days.length);

    expect(taskSlotSpy.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        slotEvents: events,
        handleViewTask,
        height: 240,
        length: days.length - 1,
      })
    );
  });

  it("updates week start and current date on navigation", () => {
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

    fireEvent.click(screen.getByText("PrevWeek"));
    fireEvent.click(screen.getByText("NextWeek"));

    const prevFn = setWeekStart.mock.calls[0][0];
    const nextFn = setWeekStart.mock.calls[1][0];

    prevFn(weekStart);
    nextFn(weekStart);

    expect(setCurrentDate).toHaveBeenCalledWith(new Date(2024, 11, 30, 12));
    expect(setCurrentDate).toHaveBeenCalledWith(new Date(2025, 0, 13, 12));
  });
});
