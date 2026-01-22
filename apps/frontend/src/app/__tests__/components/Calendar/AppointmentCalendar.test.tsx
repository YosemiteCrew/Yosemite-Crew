import React from "react";
import { render, screen } from "@testing-library/react";
import AppointmentCalendar from "@/app/components/Calendar/AppointmentCalendar";
import { Appointment } from "@yosemite-crew/types";

const daySpy = jest.fn();
const weekSpy = jest.fn();
const userSpy = jest.fn();

jest.mock("@/app/components/Calendar/common/DayCalendar", () => (props: any) => {
  daySpy(props);
  return <div data-testid="day-calendar" />;
});

jest.mock("@/app/components/Calendar/common/WeekCalendar", () => (props: any) => {
  weekSpy(props);
  return <div data-testid="week-calendar" />;
});

jest.mock("@/app/components/Calendar/common/UserCalendar", () => (props: any) => {
  userSpy(props);
  return <div data-testid="user-calendar" />;
});

jest.mock("@/app/components/Calendar/common/Header", () => (props: any) => (
  <div data-testid="calendar-header">{props.currentDate.toDateString()}</div>
));

describe("AppointmentCalendar", () => {
  const currentDate = new Date(2025, 0, 2, 9);
  const setCurrentDate = jest.fn();
  const setWeekStart = jest.fn();
  const setReschedulePopup = jest.fn();

  const appointmentA = {
    id: "appt-a",
    startTime: new Date(2025, 0, 2, 10),
    endTime: new Date(2025, 0, 2, 11),
  } as Appointment;
  const appointmentB = {
    id: "appt-b",
    startTime: new Date(2025, 0, 3, 10),
    endTime: new Date(2025, 0, 3, 11),
  } as Appointment;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders day calendar with same-day events", () => {
    render(
      <AppointmentCalendar
        filteredList={[appointmentA, appointmentB]}
        activeCalendar="day"
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        weekStart={currentDate}
        setWeekStart={setWeekStart}
        setReschedulePopup={setReschedulePopup}
      />
    );

    expect(screen.getByTestId("day-calendar")).toBeInTheDocument();
    expect(daySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        events: [appointmentA],
        date: currentDate,
      })
    );
  });

  it("renders week calendar for week view", () => {
    render(
      <AppointmentCalendar
        filteredList={[appointmentA, appointmentB]}
        activeCalendar="week"
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        weekStart={currentDate}
        setWeekStart={setWeekStart}
        setReschedulePopup={setReschedulePopup}
      />
    );

    expect(screen.getByTestId("week-calendar")).toBeInTheDocument();
    expect(weekSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        events: [appointmentA, appointmentB],
        date: currentDate,
      })
    );
  });

  it("renders team calendar with same-day events", () => {
    render(
      <AppointmentCalendar
        filteredList={[appointmentA, appointmentB]}
        activeCalendar="team"
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        weekStart={currentDate}
        setWeekStart={setWeekStart}
        setReschedulePopup={setReschedulePopup}
      />
    );

    expect(screen.getByTestId("user-calendar")).toBeInTheDocument();
    expect(userSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        events: [appointmentA],
        date: currentDate,
      })
    );
  });
});
