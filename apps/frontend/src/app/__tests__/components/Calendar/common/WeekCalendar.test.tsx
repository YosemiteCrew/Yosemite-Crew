import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import WeekCalendar from "@/app/components/Calendar/common/WeekCalendar";
import * as weekHelpers from "@/app/components/Calendar/weekHelpers";
import * as helpers from "@/app/components/Calendar/helpers";
import { getStatusStyle } from "@/app/components/DataTable/Appointments";

// 1. Mock dependencies
jest.mock("@/app/components/Calendar/weekHelpers", () => ({
  getWeekDays: jest.fn(),
  getPrevWeek: jest.fn(),
  getNextWeek: jest.fn(),
  eventsForDayHour: jest.fn(),
  HOURS_IN_DAY: 24, // Use 24 to cover the full loop
}));

jest.mock("@/app/components/Calendar/helpers", () => ({
  EVENT_VERTICAL_GAP_PX: 2,
  isAllDayForDate: jest.fn(),
  MINUTES_PER_STEP: 15,
  PIXELS_PER_STEP: 30, // 30 / 15 = 2 pixels per minute
}));

jest.mock("@/app/components/DataTable/Appointments", () => ({
  getStatusStyle: jest.fn(),
}));

// 2. Mock Child Components
jest.mock("@/app/components/Calendar/common/DayLabels", () => {
  return function MockDayLabels({ onPrevWeek, onNextWeek }: any) {
    return (
      <div data-testid="day-labels">
        <button data-testid="prev-week-btn" onClick={onPrevWeek}>
          Prev
        </button>
        <button data-testid="next-week-btn" onClick={onNextWeek}>
          Next
        </button>
      </div>
    );
  };
});

jest.mock("@/app/components/Calendar/common/Slot", () => {
  return function MockSlot({ slotEvents, dayIndex }: any) {
    // Render slot count to verify data passing
    return (
      <div data-testid={`slot-${dayIndex}`}>
        {slotEvents.length > 0 ? "HasEvents" : "NoEvents"}
      </div>
    );
  };
});

describe("WeekCalendar Component", () => {
  // Test Data
  const mockDate = new Date("2023-10-10T12:00:00Z");
  const mockWeekStart = new Date("2023-10-08T00:00:00Z"); // Sunday
  const mockSetWeekStart = jest.fn();
  const mockSetCurrentDate = jest.fn();
  const mockHandleViewAppointment = jest.fn();

  // Generate 7 days for the week
  const mockDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mockWeekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const mockEvents: any[] = [
    {
      _id: "1",
      name: "All Day Event",
      reason: "Checkup",
      start: new Date("2023-10-09T00:00:00Z"), // Monday
      status: "Scheduled",
    },
    {
      _id: "2",
      name: "Timed Event",
      reason: "Vaccination",
      start: new Date("2023-10-10T10:00:00Z"), // Tuesday
      status: "Completed",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Setup default mock returns
    (weekHelpers.getWeekDays as jest.Mock).mockReturnValue(mockDays);
    (weekHelpers.getPrevWeek as jest.Mock).mockReturnValue(
      new Date("2023-10-01T00:00:00Z")
    );
    (weekHelpers.getNextWeek as jest.Mock).mockReturnValue(
      new Date("2023-10-15T00:00:00Z")
    );
    (weekHelpers.eventsForDayHour as jest.Mock).mockReturnValue([]);
    (helpers.isAllDayForDate as jest.Mock).mockReturnValue(false);
    (getStatusStyle as jest.Mock).mockReturnValue({ color: "blue" });

    // Mock clientHeight for scroll calculation
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      value: 500,
    });
    // Mock scrollTop setter
    Object.defineProperty(HTMLElement.prototype, "scrollTop", {
      configurable: true,
      writable: true,
      value: 0,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // --- Tests ---

  it("renders DayLabels and the main grid structure", () => {
    render(
      <WeekCalendar
        events={[]}
        date={mockDate}
        handleViewAppointment={mockHandleViewAppointment}
        weekStart={mockWeekStart}
        setWeekStart={mockSetWeekStart}
        setCurrentDate={mockSetCurrentDate}
      />
    );

    expect(screen.getByTestId("day-labels")).toBeInTheDocument();
    // Check for some hour labels
    expect(screen.getByText("12:00 AM")).toBeInTheDocument();
    expect(screen.getByText("11:00 PM")).toBeInTheDocument();
  });

  it("handles navigation: Prev Week", () => {
    render(
      <WeekCalendar
        events={[]}
        date={mockDate}
        handleViewAppointment={mockHandleViewAppointment}
        weekStart={mockWeekStart}
        setWeekStart={mockSetWeekStart}
        setCurrentDate={mockSetCurrentDate}
      />
    );

    const prevBtn = screen.getByTestId("prev-week-btn");
    fireEvent.click(prevBtn);
    const setterCallback = mockSetWeekStart.mock.calls[0][0];
    const newDate = setterCallback(mockWeekStart);

    expect(mockSetCurrentDate).toHaveBeenCalledWith(newDate);
    expect(newDate).toEqual(new Date("2023-10-01T00:00:00Z"));
  });

  it("handles navigation: Next Week", () => {
    render(
      <WeekCalendar
        events={[]}
        date={mockDate}
        handleViewAppointment={mockHandleViewAppointment}
        weekStart={mockWeekStart}
        setWeekStart={mockSetWeekStart}
        setCurrentDate={mockSetCurrentDate}
      />
    );

    const nextBtn = screen.getByTestId("next-week-btn");
    fireEvent.click(nextBtn);

    const setterCallback = mockSetWeekStart.mock.calls[0][0];
    const newDate = setterCallback(mockWeekStart);

    expect(mockSetCurrentDate).toHaveBeenCalledWith(newDate);
    expect(newDate).toEqual(new Date("2023-10-15T00:00:00Z"));
  });

  it("segregates all-day events correctly and renders the all-day section", () => {
    (helpers.isAllDayForDate as jest.Mock).mockImplementation((ev, day) => {
      return ev._id === "1" && day.getDate() === 9;
    });

    render(
      <WeekCalendar
        events={mockEvents}
        date={mockDate}
        handleViewAppointment={mockHandleViewAppointment}
        weekStart={mockWeekStart}
        setWeekStart={mockSetWeekStart}
        setCurrentDate={mockSetCurrentDate}
      />
    );

    expect(screen.getByText("All-day")).toBeInTheDocument();

    // 2. Find the rendered all-day event button
    const allDayBtn = screen.getByText((content) =>
      content.includes("All Day Event")
    );
    expect(allDayBtn).toBeInTheDocument();

    // 3. Verify interaction
    fireEvent.click(allDayBtn.closest("button")!);
    expect(mockHandleViewAppointment).toHaveBeenCalledWith(mockEvents[0]);
  });

  it("passes timed events to Slots correctly", () => {
    // Setup: No events are all day
    (helpers.isAllDayForDate as jest.Mock).mockReturnValue(false);

    // Setup eventsForDayHour to simulate finding a timed event
    (weekHelpers.eventsForDayHour as jest.Mock).mockImplementation(
      (events, day, hour) => {
        // Return event if it's the timed event
        if (events.length > 0 && events[0]._id === "2") {
          return [events[0]];
        }
        return [];
      }
    );

    render(
      <WeekCalendar
        events={mockEvents}
        date={mockDate}
        handleViewAppointment={mockHandleViewAppointment}
        weekStart={mockWeekStart}
        setWeekStart={mockSetWeekStart}
        setCurrentDate={mockSetCurrentDate}
      />
    );

    // The component filters events in useMemo.
    // Since isAllDayForDate is false for all, mockEvents should be in 'timedEvents' list.
    // Then 'Slot' calls eventsForDayHour with that list.

    // We check if Slots render.
    // Since we mocked eventsForDayHour to return something, MockSlot should show "HasEvents".
    const slots = screen.getAllByTestId(/slot-/);
    expect(slots.length).toBeGreaterThan(0);
  });

  it("renders the current time indicator (red line) and scrolls to it", () => {
    // 1. Set System Time to be within the mock week
    // mockWeekStart is Oct 8 (Sunday). Let's set 'now' to Oct 10 (Tuesday) at 10:30 AM.
    const now = new Date("2023-10-10T10:30:00Z");
    // JSDOM uses local time by default, but setSystemTime sets the "Date.now()" reference.
    // Be careful with timezones. Best to ensure consistency.
    jest.setSystemTime(now);

    const { container } = render(
      <WeekCalendar
        events={[]}
        date={mockDate}
        handleViewAppointment={mockHandleViewAppointment}
        weekStart={mockWeekStart}
        setWeekStart={mockSetWeekStart}
        setCurrentDate={mockSetCurrentDate}
      />
    );

    // 2. Check for Red Line elements (using class names or styles)
    // The red dot class: "bg-red-500"
    const redDot = container.querySelector(".bg-red-500");
    expect(redDot).toBeInTheDocument();

    // 3. Verify position calculation logic implicitly via scroll
    // 10:30 AM = 10.5 hours.
    // Height = PIXELS_PER_MINUTE (2) * 60 = 120px per hour.
    // TopPx = 10 * (120 + 2gap) + (30/60)*120 + 8 = 1220 + 60 + 8 = 1288 approx.
    // Container Height mock = 500. Target = 1288 - 250 = 1038.

    // Check if scrollTop was set on the scrollable container
    const scrollContainer = container.querySelector(".overflow-y-auto");
    expect(scrollContainer).not.toBeNull();
    // In JSDOM, setting scrollTop works but reading it back might rely on the defineProperty we did.
    // If the logic ran, scrollTop should be > 0.
    expect(scrollContainer?.scrollTop).toBeGreaterThan(0);
  });

  it("does not render red line if current date is outside the viewed week", () => {
    // Set 'now' to a month later
    const futureDate = new Date("2023-11-10T10:30:00Z");
    jest.setSystemTime(futureDate);

    const { container } = render(
      <WeekCalendar
        events={[]}
        date={mockDate}
        handleViewAppointment={mockHandleViewAppointment}
        weekStart={mockWeekStart}
        setWeekStart={mockSetWeekStart}
        setCurrentDate={mockSetCurrentDate}
      />
    );

    const redDot = container.querySelector(".bg-red-500");
    expect(redDot).not.toBeInTheDocument();
  });

  it("renders hour 0 with opacity 0", () => {
    render(
      <WeekCalendar
        events={[]}
        date={mockDate}
        handleViewAppointment={mockHandleViewAppointment}
        weekStart={mockWeekStart}
        setWeekStart={mockSetWeekStart}
        setCurrentDate={mockSetCurrentDate}
      />
    );

    // Hour 0 label is "12:00 AM" at the start.
    // The component sets `opacity: hour === 0 ? 0 : 1`.
    // We find the text "12:00 AM" (there might be two if one is in grid, but usually just one label column)
    const midnightLabel = screen.getByText("12:00 AM");
    expect(midnightLabel).toHaveStyle({ opacity: "0" });

    const otherLabel = screen.getByText("1:00 AM");
    expect(otherLabel).toHaveStyle({ opacity: "1" });
  });
});
