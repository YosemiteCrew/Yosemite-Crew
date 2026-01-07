import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import WeekCalendar from "@/app/components/Calendar/common/WeekCalendar";
import { Appointment } from "@yosemite-crew/types";

// ---- Mocks ----

const mockGetWeekDays = jest.fn();
const mockGetPrevWeek = jest.fn();
const mockGetNextWeek = jest.fn();
const mockEventsForDayHour = jest.fn();

// We keep HOURS_IN_DAY small to avoid rendering 24*7 heavy DOM in unit tests
jest.mock("@/app/components/Calendar/weekHelpers", () => ({
  HOURS_IN_DAY: 2,
  getWeekDays: (...args: any[]) => mockGetWeekDays(...args),
  getPrevWeek: (...args: any[]) => mockGetPrevWeek(...args),
  getNextWeek: (...args: any[]) => mockGetNextWeek(...args),
  eventsForDayHour: (...args: any[]) => mockEventsForDayHour(...args),
}));

const mockIsAllDayForDate = jest.fn();
jest.mock("@/app/components/Calendar/helpers", () => ({
  EVENT_VERTICAL_GAP_PX: 2,
  MINUTES_PER_STEP: 30,
  PIXELS_PER_STEP: 60,
  isAllDayForDate: (...args: any[]) => mockIsAllDayForDate(...args),
}));

jest.mock("@/app/components/DataTable/Appointments", () => ({
  getStatusStyle: jest.fn(() => ({ background: "rgb(0, 0, 0)", color: "#fff" })),
}));

// Slot: render a simple marker and expose props for assertions
const slotSpy = jest.fn();
jest.mock("@/app/components/Calendar/common/Slot", () => {
  return (props: any) => {
    slotSpy(props);
    return (
      <div data-testid="slot">
        Slot {props.dayIndex} / {props.height}
      </div>
    );
  };
});

// Icons: make them clickable in tests
jest.mock("react-icons/gr", () => ({
  GrNext: (props: any) => (
    <button data-testid="next-week" onClick={props.onClick}>
      next
    </button>
  ),
  GrPrevious: (props: any) => (
    <button data-testid="prev-week" onClick={props.onClick}>
      prev
    </button>
  ),
}));

describe("WeekCalendar", () => {
  const mockSetWeekStart = jest.fn();
  const mockSetCurrentDate = jest.fn();
  const mockHandleViewAppointment = jest.fn();

  const weekStart = new Date("2025-01-06T00:00:00.000Z"); // Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const timedAppt: Appointment = {
    _id: "appt-1",
    status: "UPCOMING",
    isEmergency: false,
    startTime: new Date("2025-01-06T10:00:00.000Z"),
    appointmentDate: "2025-01-06",
    companion: { name: "Buddy" } as any,
    concern: "Vaccination",
  } as any;

  const allDayAppt: Appointment = {
    _id: "appt-2",
    status: "COMPLETED",
    isEmergency: false,
    startTime: new Date("2025-01-07T00:00:00.000Z"),
    appointmentDate: "2025-01-07",
    companion: { name: "Rex" } as any,
    concern: "All day care",
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetWeekDays.mockReturnValue(weekDays);

    // prev/next week calculations
    mockGetPrevWeek.mockImplementation((d: Date) => {
      const x = new Date(d);
      x.setDate(x.getDate() - 7);
      return x;
    });
    mockGetNextWeek.mockImplementation((d: Date) => {
      const x = new Date(d);
      x.setDate(x.getDate() + 7);
      return x;
    });

    // Default: treat allDayAppt as all-day on its date; timedAppt not all-day
    mockIsAllDayForDate.mockImplementation((ev: Appointment, day: Date) => {
      if (ev.id === "appt-2") {
        return (
          day.getFullYear() === 2025 &&
          day.getMonth() === 0 &&
          day.getDate() === 7
        );
      }
      return false;
    });

    // eventsForDayHour returns [] by default
    mockEventsForDayHour.mockReturnValue([]);
  });

  const renderCal = (events: Appointment[] = [timedAppt, allDayAppt]) =>
    render(
      <WeekCalendar
        events={events}
        date={new Date("2025-01-06T12:00:00.000Z")}
        handleViewAppointment={mockHandleViewAppointment}
        weekStart={weekStart}
        setWeekStart={mockSetWeekStart}
        setCurrentDate={mockSetCurrentDate}
      />
    );

  it("renders header days (weekday + date number) using getWeekDays(weekStart)", () => {
    renderCal();

    expect(mockGetWeekDays).toHaveBeenCalledWith(weekStart);

    // Confirm some header date numbers appear (6..12)
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("renders Slot components for each day and hour and passes slotEvents + dayIndex", () => {
    renderCal();

    // HOURS_IN_DAY mocked to 2 => 2 hours * 7 days => 14 Slot renders
    const slots = screen.getAllByTestId("slot");
    expect(slots).toHaveLength(14);

    // Slot spy lets us validate props
    expect(slotSpy).toHaveBeenCalled();
    const firstCallProps = slotSpy.mock.calls[0][0];

    expect(firstCallProps).toEqual(
      expect.objectContaining({
        dayIndex: expect.any(Number),
        height: expect.any(Number),
        slotEvents: expect.any(Array),
        handleViewAppointment: mockHandleViewAppointment,
        length: 6, // days.length - 1
      })
    );

    // eventsForDayHour should be called for each hour/day cell
    // 2 hours * 7 days = 14 calls
    expect(mockEventsForDayHour).toHaveBeenCalledTimes(14);
  });

  it("does not render the All-day row if there are no all-day events", () => {
    mockIsAllDayForDate.mockReturnValue(false);
    renderCal([timedAppt]);

    expect(screen.queryByText("All-day")).not.toBeInTheDocument();
  });

  it("navigates to previous week and sets currentDate to the computed week start", () => {
    renderCal();

    fireEvent.click(screen.getByTestId("prev-week"));

    expect(mockSetWeekStart).toHaveBeenCalledTimes(1);

    // Our component passes a functional updater; simulate it to validate behavior
    const updater = mockSetWeekStart.mock.calls[0][0];
    expect(typeof updater).toBe("function");

    const result = updater(weekStart);
    expect(result).toEqual(mockGetPrevWeek(weekStart));
    expect(mockSetCurrentDate).toHaveBeenCalledWith(result);
  });

  it("navigates to next week and sets currentDate to the computed week start", () => {
    renderCal();

    fireEvent.click(screen.getByTestId("next-week"));

    expect(mockSetWeekStart).toHaveBeenCalledTimes(1);

    const updater = mockSetWeekStart.mock.calls[0][0];
    const result = updater(weekStart);

    expect(result).toEqual(mockGetNextWeek(weekStart));
    expect(mockSetCurrentDate).toHaveBeenCalledWith(result);
  });

  it("renders a 'now' indicator when the current time falls within the visible week", () => {
    // Freeze system time to a date within our weekStart..weekStart+7d
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-01-08T12:30:00.000Z"));

    renderCal([timedAppt]);

    // The now-indicator renders a small dot div with bg-red-500
    // We'll assert its presence via className query
    const dots = document.querySelectorAll(".bg-red-500");
    expect(dots.length).toBeGreaterThan(0);

    jest.useRealTimers();
  });

  it("does not render a 'now' indicator when the current time is outside the week range", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-02-01T12:00:00.000Z"));

    renderCal([timedAppt]);

    const dots = document.querySelectorAll(".bg-red-500");
    expect(dots.length).toBe(0);

    jest.useRealTimers();
  });
});
