import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";

import AppointmentCalendar from "@/app/components/Calendar/AppointmentCalendar";

const dayCalendarSpy = jest.fn();
const weekCalendarSpy = jest.fn();
const userCalendarSpy = jest.fn();

jest.mock("@/app/components/Calendar/common/DayCalendar", () => (props: any) => {
  dayCalendarSpy(props);
  return <div data-testid="day-calendar" />;
});

jest.mock(
  "@/app/components/Calendar/common/WeekCalendar",
  () => (props: any) => {
    weekCalendarSpy(props);
    return <div data-testid="week-calendar" />;
  }
);

jest.mock(
  "@/app/components/Calendar/common/UserCalendar",
  () => (props: any) => {
    userCalendarSpy(props);
    return <div data-testid="user-calendar" />;
  }
);

jest.mock("@/app/components/Calendar/common/Header", () => (props: any) => (
  <div data-testid="calendar-header" />
));

const isSameDayMock = jest.fn();

jest.mock("@/app/components/Calendar/helpers", () => ({
  isSameDay: (...args: any[]) => isSameDayMock(...args),
}));

describe("AppointmentCalendar", () => {
  const setActiveAppointment = jest.fn();
  const setViewPopup = jest.fn();
  const setReschedulePopup = jest.fn();
  const setCurrentDate = jest.fn();
  const setWeekStart = jest.fn();

  const currentDate = new Date("2025-01-06T10:00:00Z");
  const weekStart = new Date("2025-01-06T00:00:00Z");

  const appointments: any[] = [
    { id: "a1", startTime: new Date("2025-01-06T09:00:00Z") },
    { id: "a2", startTime: new Date("2025-01-07T09:00:00Z") },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    isSameDayMock.mockImplementation((date: Date) =>
      date.toISOString().includes("2025-01-06")
    );
  });

  it("renders day calendar with filtered events and forwards handlers", () => {
    render(
      <AppointmentCalendar
        filteredList={appointments as any}
        setActiveAppointment={setActiveAppointment}
        setViewPopup={setViewPopup}
        activeCalendar="day"
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        weekStart={weekStart}
        setWeekStart={setWeekStart}
        setReschedulePopup={setReschedulePopup}
        canEditAppointments
      />
    );

    expect(dayCalendarSpy).toHaveBeenCalledTimes(1);
    const props = dayCalendarSpy.mock.calls[0][0];
    expect(props.events).toEqual([appointments[0]]);

    props.handleViewAppointment(appointments[0]);
    expect(setActiveAppointment).toHaveBeenCalledWith(appointments[0]);
    expect(setViewPopup).toHaveBeenCalledWith(true);

    props.handleRescheduleAppointment(appointments[0]);
    expect(setReschedulePopup).toHaveBeenCalledWith(true);
  });

  it("renders week calendar with full list", () => {
    render(
      <AppointmentCalendar
        filteredList={appointments as any}
        setActiveAppointment={setActiveAppointment}
        setViewPopup={setViewPopup}
        activeCalendar="week"
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        weekStart={weekStart}
        setWeekStart={setWeekStart}
        setReschedulePopup={setReschedulePopup}
        canEditAppointments
      />
    );

    expect(weekCalendarSpy).toHaveBeenCalledTimes(1);
    const props = weekCalendarSpy.mock.calls[0][0];
    expect(props.events).toEqual(appointments);
  });

  it("renders team calendar with day events", () => {
    render(
      <AppointmentCalendar
        filteredList={appointments as any}
        setActiveAppointment={setActiveAppointment}
        setViewPopup={setViewPopup}
        activeCalendar="team"
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        weekStart={weekStart}
        setWeekStart={setWeekStart}
        setReschedulePopup={setReschedulePopup}
        canEditAppointments
      />
    );

    expect(userCalendarSpy).toHaveBeenCalledTimes(1);
    const props = userCalendarSpy.mock.calls[0][0];
    expect(props.events).toEqual([appointments[0]]);
  });
});
