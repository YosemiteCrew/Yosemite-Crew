import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import WeekCalendar from "@/app/components/Calendar/common/WeekCalendar";
import { Appointment } from "@yosemite-crew/types";

jest.mock("@/app/components/DataTable/Appointments", () => ({
  getStatusStyle: () => ({}),
}));

const slotSpy = jest.fn();

jest.mock("@/app/components/Calendar/common/Slot", () => (props: any) => {
  slotSpy(props);
  return <div data-testid="slot" />;
});

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

describe("WeekCalendar", () => {
  const handleViewAppointment = jest.fn();
  const handleRescheduleAppointment = jest.fn();
  const setWeekStart = jest.fn();
  const setCurrentDate = jest.fn();

  const weekStart = new Date(2025, 0, 6, 8);

  const allDayEvent = {
    status: "CHECKED_IN",
    startTime: new Date(2025, 0, 6, 0, 0, 0),
    endTime: new Date(2025, 0, 7, 0, 0, 0),
    companion: { name: "Buddy" },
    concern: "Checkup",
  } as Appointment;

  const timedEvent = {
    status: "CHECKED_IN",
    startTime: new Date(2025, 0, 6, 9, 0, 0),
    endTime: new Date(2025, 0, 6, 10, 0, 0),
    companion: { name: "Milo" },
    concern: "Grooming",
  } as Appointment;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders all-day events and slot grid", () => {
    render(
      <WeekCalendar
        events={[allDayEvent, timedEvent]}
        date={weekStart}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        weekStart={weekStart}
        setWeekStart={setWeekStart}
        setCurrentDate={setCurrentDate}
      />
    );

    expect(screen.getByText("All-day")).toBeInTheDocument();

    const allDayButton = screen.getByText(/Buddy/).closest("button");
    fireEvent.click(allDayButton as HTMLElement);
    expect(handleViewAppointment).toHaveBeenCalledWith(allDayEvent);

    expect(screen.getAllByTestId("slot").length).toBeGreaterThan(0);
    expect(slotSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        handleViewAppointment,
        handleRescheduleAppointment,
      })
    );
  });

  it("updates week start on navigation", () => {
    render(
      <WeekCalendar
        events={[]}
        date={weekStart}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
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

    expect(setCurrentDate).toHaveBeenCalledTimes(2);
  });
});
