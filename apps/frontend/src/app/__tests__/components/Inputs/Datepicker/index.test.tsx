import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Datepicker from "@/app/components/Inputs/Datepicker";

// --- Mocks ---

// FIX: Use absolute paths (aliases) instead of relative paths to ensure resolution works
// regardless of where the test file is located.

jest.mock("@/app/components/Calendar/helpers", () => ({
  isSameDay: (d1: Date, d2: Date | null) =>
    d2 &&
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear(),
  isSameMonth: (d1: Date, d2: Date) => d1.getMonth() === d2.getMonth(),
}));

jest.mock("@/app/components/Calendar/weekHelpers", () => ({
  getFormattedDate: (date: Date) => date.toLocaleDateString("en-US"),
}));

// Mock Child Components (Year/Month selectors) to simplify integration testing
jest.mock("@/app/components/Inputs/Datepicker/Year", () => ({
  __esModule: true,
  default: ({ viewYear }: any) => (
    <div data-testid="year-display">{viewYear}</div>
  ),
}));

jest.mock("@/app/components/Inputs/Datepicker/Month", () => ({
  __esModule: true,
  default: ({ viewMonth, monthNames }: any) => (
    <div data-testid="month-display">{monthNames[viewMonth]}</div>
  ),
}));

// Mock Icons
jest.mock("react-icons/io5", () => ({
  IoCalendarClear: () => <div data-testid="calendar-icon" />,
}));
jest.mock("react-icons/gr", () => ({
  GrNext: ({ onClick }: any) => (
    <button data-testid="next-month" onClick={onClick}>
      Next
    </button>
  ),
  GrPrevious: ({ onClick }: any) => (
    <button data-testid="prev-month" onClick={onClick}>
      Prev
    </button>
  ),
}));

describe("Datepicker Component", () => {
  const mockSetCurrentDate = jest.fn();
  // Freeze time to 2023-06-15 for consistent calendar generation
  const fixedDate = new Date(2023, 5, 15); // June 15, 2023

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedDate);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering & Modes ---

  it("renders as an input field by default (type='input')", () => {
    render(
      <Datepicker
        currentDate={null}
        setCurrentDate={mockSetCurrentDate}
        type="input"
        placeholder="Select Date"
      />
    );

    expect(screen.getByPlaceholderText("Select Date")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-icon")).toBeInTheDocument();
  });

  it("renders as an icon button when type is not 'input'", () => {
    render(
      <Datepicker
        currentDate={null}
        setCurrentDate={mockSetCurrentDate}
        type="icon"
        placeholder="Select Date"
      />
    );

    // Should NOT find the input field
    expect(
      screen.queryByPlaceholderText("Select Date")
    ).not.toBeInTheDocument();
    // Should find the icon button wrapper (button containing the icon)
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(screen.getByTestId("calendar-icon")).toBeInTheDocument();
  });

  it("displays the formatted date in the input when a date is selected", () => {
    const selectedDate = new Date(2023, 5, 20); // June 20, 2023
    render(
      <Datepicker
        currentDate={selectedDate}
        setCurrentDate={mockSetCurrentDate}
        type="input"
        placeholder="Select Date"
      />
    );
  });

  // --- 2. Interaction (Open/Close) ---

  it("toggles the calendar popup when clicking the input/icon", () => {
    render(
      <Datepicker
        currentDate={null}
        setCurrentDate={mockSetCurrentDate}
        type="icon"
        placeholder="Select Date"
      />
    );

    const toggleBtn = screen.getByRole("button");

    // Initial state: Closed
    expect(screen.queryByTestId("year-display")).not.toBeInTheDocument();

    // Click to Open
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId("year-display")).toBeInTheDocument();

    // Click to Close
    fireEvent.click(toggleBtn);
    expect(screen.queryByTestId("year-display")).not.toBeInTheDocument();
  });

  it("closes the calendar when clicking outside", () => {
    render(
      <div>
        <Datepicker
          currentDate={null}
          setCurrentDate={mockSetCurrentDate}
          type="icon"
          placeholder="Select Date"
        />
        <div data-testid="outside">Outside</div>
      </div>
    );

    // Open first
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByTestId("year-display")).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(screen.getByTestId("outside"));

    // Should close
    expect(screen.queryByTestId("year-display")).not.toBeInTheDocument();
  });

  // --- 3. Navigation (Month/Year) ---

  it("navigates to the previous and next month", () => {
    // Initial view: June 2023 (from frozen system time)
    render(
      <Datepicker
        currentDate={fixedDate}
        setCurrentDate={mockSetCurrentDate}
        type="icon"
        placeholder="Select Date"
      />
    );

    // Open calendar
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByTestId("month-display")).toHaveTextContent("June");
    expect(screen.getByTestId("year-display")).toHaveTextContent("2023");

    // Click Prev
    fireEvent.click(screen.getByTestId("prev-month"));
    expect(screen.getByTestId("month-display")).toHaveTextContent("May");

    // Click Next (back to June)
    fireEvent.click(screen.getByTestId("next-month"));
    expect(screen.getByTestId("month-display")).toHaveTextContent("June");

    // Click Next again (July)
    fireEvent.click(screen.getByTestId("next-month"));
    expect(screen.getByTestId("month-display")).toHaveTextContent("July");
  });

  // --- 4. Date Selection ---

  it("selects a date and closes the calendar", () => {
    render(
      <Datepicker
        currentDate={fixedDate} // June 15, 2023
        setCurrentDate={mockSetCurrentDate}
        type="input"
        placeholder="Select Date"
      />
    );

    // Open calendar
    const input = screen.getByPlaceholderText("Select Date");
    fireEvent.click(input);

    // Find the button for date "20" (June 20th)
    const dayButton = screen.getByText("20");

    fireEvent.click(dayButton);

    // 1. Should call setCurrentDate
    expect(mockSetCurrentDate).toHaveBeenCalled();
    // Verify it called with a Date object for the 20th
    const callArg = mockSetCurrentDate.mock.calls[0][0];
    expect(callArg.getDate()).toBe(20);
    expect(callArg.getMonth()).toBe(5); // June

    // 2. Should close popup
    expect(screen.queryByTestId("year-display")).not.toBeInTheDocument();
  });

  it("highlights the current date and today's date correctly", () => {
    render(
      <Datepicker
        currentDate={fixedDate} // Selected: June 15
        setCurrentDate={mockSetCurrentDate}
        type="input"
        placeholder="Select Date"
      />
    );

    fireEvent.click(screen.getByPlaceholderText("Select Date"));

    // Check "15" (Selected)
    const selectedDay = screen.getByText("15");
    // logic: isSelected ? "bg-[#EAF3FF]"
    expect(selectedDay.className).toContain("bg-[#EAF3FF]");
  });

  it("renders correctly when currentDate is null (defaults to today)", () => {
    // Current system time: June 15, 2023
    render(
      <Datepicker
        currentDate={null}
        setCurrentDate={mockSetCurrentDate}
        type="input"
        placeholder="Select Date"
      />
    );

    fireEvent.click(screen.getByPlaceholderText("Select Date"));
  });
});
