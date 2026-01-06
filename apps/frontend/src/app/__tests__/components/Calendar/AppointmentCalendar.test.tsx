import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import AppointmentCalendar from "@/app/components/Calendar/AppointmentCalendar";
import { Appointment } from "@yosemite-crew/types";

// --- Mocks ---

// Mock Helper: Simple true/false control for testing filter logic
jest.mock("@/app/components/Calendar/helpers", () => ({
  isSameDay: jest.fn(),
}));
import { isSameDay } from "@/app/components/Calendar/helpers";

// Mock Child Components
jest.mock("@/app/components/Calendar/common/Header", () => {
  return function MockHeader(props: any) {
    return (
      <div data-testid="header">
        Header - Current: {props.currentDate.toISOString()}
        <button onClick={() => props.setCurrentDate(new Date("2023-01-02"))}>
          Change Date
        </button>
      </div>
    );
  };
});

jest.mock("@/app/components/Calendar/common/DayCalendar", () => {
  return function MockDayCalendar(props: any) {
    return (
      <div data-testid="day-calendar">
        Day View
        <ul>
          {props.events.map((e: any) => (
            <li key={e._id}>
              {/* FIX: Use a button for interactivity to satisfy accessibility rules */}
              <button
                data-testid={`day-event-${e._id}`}
                onClick={() => props.handleViewAppointment(e)}
              >
                {e.title}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  };
});

jest.mock("@/app/components/Calendar/common/WeekCalendar", () => {
  return function MockWeekCalendar(props: any) {
    return (
      <div data-testid="week-calendar">
        Week View
        <ul>
          {props.events.map((e: any) => (
            <li key={e._id}>
              {/* FIX: Use a button for interactivity to satisfy accessibility rules */}
              <button
                data-testid={`week-event-${e._id}`}
                onClick={() => props.handleViewAppointment(e)}
              >
                {e.title}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  };
});

// --- Test Data ---

const mockDate = new Date("2023-01-01T00:00:00.000Z");
const mockAppointments: Appointment[] = [
  { _id: "1", title: "Appt 1", startTime: "2023-01-01T10:00:00Z" } as any,
  { _id: "2", title: "Appt 2", startTime: "2023-01-02T10:00:00Z" } as any,
];

describe("AppointmentCalendar Component", () => {
  const mockSetActiveAppointment = jest.fn();
  const mockSetViewPopup = jest.fn();
  const mockSetCurrentDate = jest.fn();
  const mockSetWeekStart = jest.fn();

  const defaultProps = {
    filteredList: mockAppointments,
    setActiveAppointment: mockSetActiveAppointment,
    setViewPopup: mockSetViewPopup,
    activeCalendar: "day",
    currentDate: mockDate,
    setCurrentDate: mockSetCurrentDate,
    weekStart: mockDate,
    setWeekStart: mockSetWeekStart,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (isSameDay as jest.Mock).mockImplementation((d1, d2) => {
      // Simple mock: strictly compare date strings for test stability
      return d1.toISOString().split("T")[0] === d2.toISOString().split("T")[0];
    });
  });

  // --- 1. Rendering & Logic ---

  it("renders the container and Header", () => {
    render(<AppointmentCalendar {...defaultProps} />);
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByText(/Header - Current:/)).toBeInTheDocument();
  });

  it("filters events correctly for Day View using useMemo", () => {
    // isSameDay mock returns true only for "2023-01-01"
    // So only Appt 1 should appear in Day View, Appt 2 should be filtered out
    render(<AppointmentCalendar {...defaultProps} activeCalendar="day" />);

    expect(screen.getByTestId("day-calendar")).toBeInTheDocument();
    expect(screen.getByTestId("day-event-1")).toBeInTheDocument();
    expect(screen.queryByTestId("day-event-2")).not.toBeInTheDocument();
  });

  // --- 2. View Switching ---

  it("renders DayCalendar when activeCalendar is 'day'", () => {
    render(<AppointmentCalendar {...defaultProps} activeCalendar="day" />);
    expect(screen.getByTestId("day-calendar")).toBeInTheDocument();
    expect(screen.queryByTestId("week-calendar")).not.toBeInTheDocument();
  });

  it("renders WeekCalendar when activeCalendar is 'week'", () => {
    render(<AppointmentCalendar {...defaultProps} activeCalendar="week" />);
    expect(screen.getByTestId("week-calendar")).toBeInTheDocument();
    expect(screen.queryByTestId("day-calendar")).not.toBeInTheDocument();

    // Week view receives FULL list (not filtered by day)
    expect(screen.getByTestId("week-event-1")).toBeInTheDocument();
    expect(screen.getByTestId("week-event-2")).toBeInTheDocument();
  });

  it("renders nothing (besides header) if activeCalendar is invalid", () => {
    render(<AppointmentCalendar {...defaultProps} activeCalendar="month" />);
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.queryByTestId("day-calendar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("week-calendar")).not.toBeInTheDocument();
  });

  // --- 3. Interactions ---

  it("handles viewing an appointment from Day View", () => {
    render(<AppointmentCalendar {...defaultProps} activeCalendar="day" />);

    const event = screen.getByTestId("day-event-1");
    fireEvent.click(event);

    expect(mockSetActiveAppointment).toHaveBeenCalledWith(mockAppointments[0]);
    expect(mockSetViewPopup).toHaveBeenCalledWith(true);
  });

  it("handles viewing an appointment from Week View", () => {
    render(<AppointmentCalendar {...defaultProps} activeCalendar="week" />);

    const event = screen.getByTestId("week-event-2");
    fireEvent.click(event);

    expect(mockSetActiveAppointment).toHaveBeenCalledWith(mockAppointments[1]);
    expect(mockSetViewPopup).toHaveBeenCalledWith(true);
  });

  it("passes setCurrentDate prop down to Header correctly", () => {
    render(<AppointmentCalendar {...defaultProps} />);

    const changeBtn = screen.getByText("Change Date");
    fireEvent.click(changeBtn);

    // Header mock calls props.setCurrentDate
    expect(mockSetCurrentDate).toHaveBeenCalled();
  });

  // --- 4. Optional Props ---

  it("handles missing optional callbacks safely", () => {
    // Render without setActiveAppointment/setViewPopup
    render(
      <AppointmentCalendar
        {...defaultProps}
        setActiveAppointment={undefined}
        setViewPopup={undefined}
      />
    );

    const event = screen.getByTestId("day-event-1");
    fireEvent.click(event);

    // Should not crash
    expect(mockSetActiveAppointment).not.toHaveBeenCalled();
    expect(mockSetViewPopup).not.toHaveBeenCalled();
  });
});
