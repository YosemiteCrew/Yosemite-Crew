import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import WeekCalendar from "@/app/components/Calendar/common/WeekCalendar";

const mockGetWeekDays = jest.fn();
const mockGetPrevWeek = jest.fn();
const mockGetNextWeek = jest.fn();
const mockEventsForDayHour = jest.fn();

jest.mock("@/app/components/Calendar/weekHelpers", () => ({
  getWeekDays: (...args: any[]) => mockGetWeekDays(...args),
  getPrevWeek: (...args: any[]) => mockGetPrevWeek(...args),
  getNextWeek: (...args: any[]) => mockGetNextWeek(...args),
  eventsForDayHour: (...args: any[]) => mockEventsForDayHour(...args),
  HOURS_IN_DAY: 2,
}));

jest.mock("@/app/components/Calendar/helpers", () => ({
  EVENT_VERTICAL_GAP_PX: 2,
  MINUTES_PER_STEP: 60,
  PIXELS_PER_STEP: 60,
  isAllDayForDate: jest.fn((event: any) => event.id === "all-day"),
}));

const slotSpy = jest.fn();

jest.mock("@/app/components/Calendar/common/Slot", () => (props: any) => {
  slotSpy(props);
  return <div data-testid="slot" />;
});

jest.mock("@/app/components/DataTable/Appointments", () => ({
  getStatusStyle: jest.fn(() => ({ backgroundColor: "pink", color: "white" })),
}));

jest.mock("@/app/components/Icons/Back", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      PrevWeek
    </button>
  ),
}));

jest.mock("@/app/components/Icons/Next", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      NextWeek
    </button>
  ),
}));

describe("WeekCalendar (Appointments)", () => {
  const handleViewAppointment = jest.fn();
  const handleRescheduleAppointment = jest.fn();
  const setWeekStart = jest.fn();
  const setCurrentDate = jest.fn();

  const weekStart = new Date("2025-01-06T00:00:00Z");
  const days = [
    new Date("2025-01-06T00:00:00Z"),
    new Date("2025-01-07T00:00:00Z"),
    new Date("2025-01-08T00:00:00Z"),
  ];

  const events: any[] = [
    {
      id: "all-day",
      status: "completed",
      startTime: new Date("2025-01-07T00:00:00Z"),
      companion: { name: "Milo", parent: { name: "Sam" } },
      concern: "Checkup",
    },
    {
      id: "timed",
      status: "in_progress",
      startTime: new Date("2025-01-06T09:00:00Z"),
      companion: { name: "Rex", parent: { name: "Alex" } },
      concern: "Grooming",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetWeekDays.mockReturnValue(days);
    mockEventsForDayHour.mockReturnValue([events[1]]);
    mockGetPrevWeek.mockReturnValue(new Date("2024-12-30T00:00:00Z"));
    mockGetNextWeek.mockReturnValue(new Date("2025-01-13T00:00:00Z"));
  });

  it("renders day headers and all-day events", () => {
    render(
      <WeekCalendar
        events={events}
        date={weekStart}
        handleViewAppointment={handleViewAppointment}
        weekStart={weekStart}
        setWeekStart={setWeekStart}
        setCurrentDate={setCurrentDate}
        handleRescheduleAppointment={handleRescheduleAppointment}
        canEditAppointments
      />
    );

    expect(screen.getByText("All-day")).toBeInTheDocument();
    const allDayButton = screen.getAllByText(/Milo/)[0].closest("button");
    fireEvent.click(allDayButton!);

    expect(handleViewAppointment).toHaveBeenCalledWith(events[0]);
    expect(slotSpy).toHaveBeenCalled();
  });

  it("updates week start and current date on navigation", () => {
    render(
      <WeekCalendar
        events={events}
        date={weekStart}
        handleViewAppointment={handleViewAppointment}
        weekStart={weekStart}
        setWeekStart={setWeekStart}
        setCurrentDate={setCurrentDate}
        handleRescheduleAppointment={handleRescheduleAppointment}
        canEditAppointments
      />
    );

    fireEvent.click(screen.getByText("PrevWeek"));
    fireEvent.click(screen.getByText("NextWeek"));

    const prevFn = setWeekStart.mock.calls[0][0];
    const nextFn = setWeekStart.mock.calls[1][0];

    prevFn(weekStart);
    nextFn(weekStart);

    expect(setCurrentDate).toHaveBeenCalledWith(new Date("2024-12-30T00:00:00Z"));
    expect(setCurrentDate).toHaveBeenCalledWith(new Date("2025-01-13T00:00:00Z"));
  });

  it("shows now indicator when current time is within week", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-01-08T10:00:00Z"));

    const { container } = render(
      <WeekCalendar
        events={events}
        date={weekStart}
        handleViewAppointment={handleViewAppointment}
        weekStart={weekStart}
        setWeekStart={setWeekStart}
        setCurrentDate={setCurrentDate}
        handleRescheduleAppointment={handleRescheduleAppointment}
        canEditAppointments
      />
    );

    expect(container.querySelector(".border-t-red-500")).toBeInTheDocument();

    jest.useRealTimers();
  });
});
