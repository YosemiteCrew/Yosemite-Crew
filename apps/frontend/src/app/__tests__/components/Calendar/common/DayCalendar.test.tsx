import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import DayCalendar from "@/app/components/Calendar/common/DayCalendar";
import { Appointment } from "@yosemite-crew/types";

// --- Mocks ---

// Mock Helpers
jest.mock("@/app/components/Calendar/helpers", () => ({
  getDayWithDate: jest.fn(() => "Monday 01"),
  getDayWindow: jest.fn(() => ({ windowStart: 0, windowEnd: 100 })),
  getTotalWindowHeightPx: jest.fn(() => 1000),
  layoutDayEvents: jest.fn(() => []), // Default empty, overridden in tests
  isAllDayForDate: jest.fn(),
  EVENT_HORIZONTAL_GAP_PX: 2,
  EVENT_VERTICAL_GAP_PX: 2,
}));

import {
  isAllDayForDate,
  layoutDayEvents,
  getDayWindow,
  getTotalWindowHeightPx,
  getDayWithDate,
} from "@/app/components/Calendar/helpers";

// Mock Styles
jest.mock("@/app/components/DataTable/Appointments", () => ({
  getStatusStyle: jest.fn(() => ({ backgroundColor: "red", color: "white" })),
}));

// Mock Child Components
jest.mock("@/app/components/Calendar/common/TimeLabels", () => () => (
  <div data-testid="time-labels">TimeLabels</div>
));
jest.mock("@/app/components/Calendar/common/HorizontalLines", () => () => (
  <div data-testid="horizontal-lines">HorizontalLines</div>
));

// Mock Next/Image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} alt={props.alt} />,
}));

// --- Test Data ---

const mockDate = new Date("2023-01-01T00:00:00.000Z");

const mockAllDayEvent: Appointment = {
  _id: "1",
  title: "All Day Event",
  startTime: new Date("2023-01-01T00:00:00Z"),
  endTime: new Date("2023-01-01T23:59:59Z"),
  status: "Confirmed",
  concern: "Vaccination",
  companion: { name: "Buddy", parent: { name: "John Doe" } },
  lead: { name: "Dr. Smith" },
} as any;

const mockTimedEvent: Appointment = {
  _id: "2",
  title: "Timed Event",
  startTime: new Date("2023-01-01T10:00:00Z"),
  endTime: new Date("2023-01-01T11:00:00Z"),
  status: "Pending",
  concern: "Checkup",
  companion: { name: "Luna", parent: { name: "Jane Doe" } },
  lead: { name: "Dr. Jones" },
} as any;

describe("DayCalendar Component", () => {
  const mockHandleViewAppointment = jest.fn();
  const mockSetCurrentDate = jest.fn();

  const defaultProps = {
    events: [mockAllDayEvent, mockTimedEvent],
    date: mockDate,
    handleViewAppointment: mockHandleViewAppointment,
    setCurrentDate: mockSetCurrentDate,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Helper Behavior
    (isAllDayForDate as jest.Mock).mockImplementation((ev) => ev._id === "1");

    (layoutDayEvents as jest.Mock).mockReturnValue([
      {
        ...mockTimedEvent,
        topPx: 100,
        heightPx: 50,
        columnIndex: 0,
        columnsCount: 1,
      },
    ]);
  });

  // --- 1. Rendering Structure ---

  it("renders the header with date and navigation icons", () => {
    render(<DayCalendar {...defaultProps} />);

    expect(screen.getByText("Monday 01")).toBeInTheDocument();
    expect(getDayWithDate).toHaveBeenCalledWith(mockDate);
    // 2 Icons (Prev/Next) from react-icons are rendered as SVGs
    expect(document.querySelectorAll("svg")).toHaveLength(2);
  });

  it("renders TimeLabels and HorizontalLines", () => {
    render(<DayCalendar {...defaultProps} />);
    expect(screen.getByTestId("time-labels")).toBeInTheDocument();
    expect(screen.getByTestId("horizontal-lines")).toBeInTheDocument();
  });

  // --- 2. Event Separation Logic ---

  it("splits events into All-Day and Timed categories", () => {
    render(<DayCalendar {...defaultProps} />);

    // Check All-Day Section
    expect(screen.getByText("All-day")).toBeInTheDocument();
    expect(screen.getByText("Buddy")).toBeInTheDocument(); // All Day Pet Name

    // Check Timed Section (via helper call verification)
    expect(layoutDayEvents).toHaveBeenCalledWith(
      expect.arrayContaining([mockTimedEvent]), // Should receive timed event
      expect.anything(),
      expect.anything()
    );
    expect(screen.getByText("Luna")).toBeInTheDocument(); // Timed Pet Name
  });

  it("calculates layout metrics correctly using helpers", () => {
    render(<DayCalendar {...defaultProps} />);

    // Verify getDayWindow called with timed events
    expect(getDayWindow).toHaveBeenCalledWith(
      expect.arrayContaining([mockTimedEvent])
    );

    // Verify getTotalWindowHeightPx called
    expect(getTotalWindowHeightPx).toHaveBeenCalled();
  });

  // --- 3. Interaction & Navigation ---

  it("handles Next Day navigation", () => {
    render(<DayCalendar {...defaultProps} />);

    // Find Next Icon (Second SVG)
    const nextBtn = document.querySelectorAll("svg")[1];
    fireEvent.click(nextBtn);

    expect(mockSetCurrentDate).toHaveBeenCalled();
    // Simulate update function
    const updateFn = mockSetCurrentDate.mock.calls[0][0];
    const newDate = updateFn(new Date("2023-01-01"));
    expect(newDate.getDate()).toBe(2);
  });

  it("handles Previous Day navigation", () => {
    render(<DayCalendar {...defaultProps} />);

    // Find Prev Icon (First SVG)
    const prevBtn = document.querySelectorAll("svg")[0];
    fireEvent.click(prevBtn);

    expect(mockSetCurrentDate).toHaveBeenCalled();
    // Simulate update function
    const updateFn = mockSetCurrentDate.mock.calls[0][0];
    const newDate = updateFn(new Date("2023-01-01"));
    expect(newDate.getDate()).toBe(31); // Dec 31
  });

  it("calls handleViewAppointment when clicking an All-Day event", () => {
    render(<DayCalendar {...defaultProps} />);

    const allDayBtn = screen.getByText("Buddy").closest("button");
    fireEvent.click(allDayBtn!);

    expect(mockHandleViewAppointment).toHaveBeenCalledWith(mockAllDayEvent);
  });

  it("calls handleViewAppointment when clicking a Timed event", () => {
    render(<DayCalendar {...defaultProps} />);

    const timedBtn = screen.getByText("Luna").closest("button");
    fireEvent.click(timedBtn!);

    expect(mockHandleViewAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "2" }) // The laid out event
    );
  });

  // --- 4. Style & Edge Cases ---

  it("applies correct inline styles to timed events", () => {
    render(<DayCalendar {...defaultProps} />);

    const timedBtn = screen.getByText("Luna").closest("button");

    // Based on mock: topPx=100, heightPx=50, colIndex=0, colCount=1
    // top: 100
    // height: 50 - 2 (gap) = 48
    // left: 0% + 2px
    // width: 100% - 4px
    expect(timedBtn).toHaveStyle("top: 100px");
    expect(timedBtn).toHaveStyle("height: 48px");
    expect(timedBtn).toHaveStyle("left: calc(0% + 2px)");
    expect(timedBtn).toHaveStyle("width: calc(100% - 4px)");
  });

  it("renders correctly without all-day events", () => {
    (isAllDayForDate as jest.Mock).mockReturnValue(false); // No all-day events

    render(<DayCalendar {...defaultProps} />);

    expect(screen.queryByText("All-day")).not.toBeInTheDocument();
    // Timed events should still exist
    expect(screen.getByText("Luna")).toBeInTheDocument();
  });

  it("enforces minimum height of 12px for tiny events", () => {
    // Override layout to return a very small event
    (layoutDayEvents as jest.Mock).mockReturnValue([
      {
        ...mockTimedEvent,
        topPx: 100,
        heightPx: 5, // Very small height
        columnIndex: 0,
        columnsCount: 1,
      },
    ]);

    render(<DayCalendar {...defaultProps} />);

    const timedBtn = screen.getByText("Luna").closest("button");
    // Math.max(5 - 2, 12) -> 12px
    expect(timedBtn).toHaveStyle("height: 12px");
  });
});
