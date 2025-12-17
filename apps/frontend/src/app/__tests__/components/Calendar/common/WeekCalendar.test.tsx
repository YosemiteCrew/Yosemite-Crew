import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import WeekCalendar from "@/app/components/Calendar/common/WeekCalendar";
import { Appointment } from "@yosemite-crew/types";

// --- Mocks ---

// Mock Week Helpers
jest.mock("@/app/components/Calendar/weekHelpers", () => ({
  getWeekDays: jest.fn(() => [
    new Date("2023-01-01T00:00:00Z"), // Sunday
    new Date("2023-01-02T00:00:00Z"),
    new Date("2023-01-03T00:00:00Z"),
    new Date("2023-01-04T00:00:00Z"),
    new Date("2023-01-05T00:00:00Z"),
    new Date("2023-01-06T00:00:00Z"),
    new Date("2023-01-07T00:00:00Z"),
  ]),
  getPrevWeek: jest.fn((d) => new Date(d.getTime() - 7 * 24 * 60 * 60 * 1000)),
  getNextWeek: jest.fn((d) => new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000)),
  eventsForDayHour: jest.fn(),
  HOURS_IN_DAY: 24,
}));

// Mock General Helpers
jest.mock("@/app/components/Calendar/helpers", () => ({
  isAllDayForDate: jest.fn(),
  EVENT_VERTICAL_GAP_PX: 2,
  MINUTES_PER_STEP: 15,
  PIXELS_PER_STEP: 25,
}));

// Mock Styles
jest.mock("@/app/components/DataTable/Appointments", () => ({
  getStatusStyle: jest.fn(() => ({ backgroundColor: "blue" })),
}));

// Mock Components
jest.mock("@/app/components/Calendar/common/DayLabels", () => {
  return function MockDayLabels({ onPrevWeek, onNextWeek }: any) {
    return (
      <div data-testid="day-labels">
        <button onClick={onPrevWeek}>Prev</button>
        <button onClick={onNextWeek}>Next</button>
      </div>
    );
  };
});

jest.mock("@/app/components/Calendar/common/Slot", () => {
  return function MockSlot({ slotEvents }: any) {
    return (
      <div data-testid="slot">{slotEvents.length > 0 ? "HasEvent" : ""}</div>
    );
  };
});

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} alt="" />,
}));

import { isAllDayForDate } from "@/app/components/Calendar/helpers";
import {
  eventsForDayHour,
} from "@/app/components/Calendar/weekHelpers";

// --- Test Data ---

const mockDate = new Date("2023-01-01T10:00:00Z");
const mockWeekStart = new Date("2023-01-01T00:00:00Z");

const mockAllDayEvent: Appointment = {
  _id: "1",
  title: "Full Day",
  startTime: new Date("2023-01-01"),
  companion: { name: "Buddy" },
  status: "Confirmed",
} as any;

const mockTimedEvent: Appointment = {
  _id: "2",
  title: "Timed",
  startTime: new Date("2023-01-01T10:00:00Z"),
  companion: { name: "Luna" },
  status: "Pending",
} as any;

describe("WeekCalendar Component", () => {
  const mockHandleViewAppointment = jest.fn();
  const mockSetWeekStart = jest.fn();
  const mockSetCurrentDate = jest.fn();

  const defaultProps = {
    events: [mockAllDayEvent, mockTimedEvent],
    date: mockDate,
    handleViewAppointment: mockHandleViewAppointment,
    weekStart: mockWeekStart,
    setWeekStart: mockSetWeekStart,
    setCurrentDate: mockSetCurrentDate,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Helper Behaviors
    // Force isAllDayForDate to return true for mockAllDayEvent
    (isAllDayForDate as jest.Mock).mockImplementation((ev) => ev._id === "1");

    (eventsForDayHour as jest.Mock).mockImplementation((events) => {
      if (events.some((e: any) => e._id === "2")) return [mockTimedEvent];
      return [];
    });
  });

  // --- 1. Rendering & Logic ---

  it("renders DayLabels", () => {
    render(<WeekCalendar {...defaultProps} />);
    expect(screen.getByTestId("day-labels")).toBeInTheDocument();
  });

  it("separates all-day events correctly", () => {
    render(<WeekCalendar {...defaultProps} />);

    // "All-day" label should appear
    expect(screen.getByText("All-day")).toBeInTheDocument();

    // Check All-Day event rendering.
    // Since the event is shown for every day in the mocked week, we expect multiple.
    const allDayEvents = screen.getAllByText(/Buddy/);
    expect(allDayEvents.length).toBeGreaterThan(0);
  });

  it("does not render 'All-day' section if no all-day events exist", () => {
    (isAllDayForDate as jest.Mock).mockReturnValue(false); // Force all to be timed

    render(<WeekCalendar {...defaultProps} />);

    expect(screen.queryByText("All-day")).not.toBeInTheDocument();
  });

  it("renders 24 hour rows with Slots", () => {
    render(<WeekCalendar {...defaultProps} />);

    // 24 hours * 7 days = 168 slots
    const slots = screen.getAllByTestId("slot");
    expect(slots.length).toBe(24 * 7);
  });

  // --- 2. Current Time Indicator & Scrolling ---

  it("calculates 'now' position and scrolls if current time is within the week", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2023-01-01T12:30:00Z"));

    const { container } = render(<WeekCalendar {...defaultProps} />);

    const redIndicator = container.querySelector(".bg-red-500");
    expect(redIndicator).toBeInTheDocument();

    jest.useRealTimers();
  });

  it("does not render 'now' indicator if current time is outside the week", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2022-01-01T12:00:00Z"));

    const { container } = render(<WeekCalendar {...defaultProps} />);
    const redIndicator = container.querySelector(".bg-red-500");

    expect(redIndicator).not.toBeInTheDocument();

    jest.useRealTimers();
  });

  // --- 3. Navigation ---

  it("handles Previous Week navigation", () => {
    render(<WeekCalendar {...defaultProps} />);

    fireEvent.click(screen.getByText("Prev"));

    expect(mockSetWeekStart).toHaveBeenCalled();
    const updateFn = mockSetWeekStart.mock.calls[0][0];
    const prevDate = new Date("2023-01-08");
    const result = updateFn(prevDate);

    expect(mockSetCurrentDate).toHaveBeenCalledWith(result);
    expect(result.getTime()).toBeLessThan(prevDate.getTime());
  });

  it("handles Next Week navigation", () => {
    render(<WeekCalendar {...defaultProps} />);

    fireEvent.click(screen.getByText("Next"));

    expect(mockSetWeekStart).toHaveBeenCalled();
    const updateFn = mockSetWeekStart.mock.calls[0][0];
    const prevDate = new Date("2023-01-01");
    const result = updateFn(prevDate);

    expect(mockSetCurrentDate).toHaveBeenCalledWith(result);
    expect(result.getTime()).toBeGreaterThan(prevDate.getTime());
  });

  // --- 4. Interactions ---

  it("calls handleViewAppointment when clicking an all-day event", () => {
    render(<WeekCalendar {...defaultProps} />);

    // Get ALL "Buddy" texts, then pick the first one's button
    const eventTexts = screen.getAllByText(/Buddy/);
    const eventBtn = eventTexts[0].closest("button");

    fireEvent.click(eventBtn!);

    expect(mockHandleViewAppointment).toHaveBeenCalledWith(mockAllDayEvent);
  });
});
