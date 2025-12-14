import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import Slotpicker from "@/app/components/Inputs/Slotpicker";
import * as weekHelpers from "@/app/components/Calendar/weekHelpers";
import * as helpers from "@/app/components/Calendar/helpers";

// --- Mocks ---

// Mock Icons to easily distinguish buttons
jest.mock("react-icons/gr", () => ({
  GrPrevious: ({ onClick, className }: any) => (
    <button data-testid="icon-prev" className={className} onClick={onClick}>
      Prev
    </button>
  ),
  GrNext: ({ onClick, className }: any) => (
    <button data-testid="icon-next" className={className} onClick={onClick}>
      Next
    </button>
  ),
}));

// Mock Date Helpers
jest.mock("@/app/components/Calendar/weekHelpers", () => ({
  getStartOfWeek: jest.fn(),
  getWeekDays: jest.fn(),
  getPrevWeek: jest.fn(),
  getNextWeek: jest.fn(),
  getShortWeekday: jest.fn(),
  getDateNumberPadded: jest.fn(),
}));

jest.mock("@/app/components/Calendar/helpers", () => ({
  isSameDay: jest.fn(),
}));

describe("Slotpicker Component", () => {
  const mockSetSelectedDate = jest.fn();
  const mockSetSelectedSlot = jest.fn();

  // Fixed Date: Oct 15, 2023 (Sunday)
  const initialDate = new Date("2023-10-15T12:00:00Z");
  // Week Start: Oct 15, 2023
  const weekStartDate = new Date("2023-10-15T00:00:00Z");

  // Mock days for the week
  const mockDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStartDate);
    d.setDate(d.getDate() + i);
    return d;
  });

  // Fixed: Added 'vetIds' to match the Slot interface required by Slotpicker
  const mockTimeSlots = [
    {
      id: "1",
      startTime: "10:00 AM",
      endTime: "11:00 AM",
      label: "10:00 AM",
      vetIds: [],
    },
    {
      id: "2",
      startTime: "12:00 PM",
      endTime: "01:00 PM",
      label: "12:00 PM",
      vetIds: [],
    },
    {
      id: "3",
      startTime: "03:00 PM",
      endTime: "04:00 PM",
      label: "3:00 PM",
      vetIds: [],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Implementations
    (weekHelpers.getStartOfWeek as jest.Mock).mockReturnValue(weekStartDate);
    (weekHelpers.getWeekDays as jest.Mock).mockReturnValue(mockDays);
    (weekHelpers.getPrevWeek as jest.Mock).mockReturnValue(
      new Date("2023-10-08T00:00:00Z")
    );
    (weekHelpers.getNextWeek as jest.Mock).mockReturnValue(
      new Date("2023-10-22T00:00:00Z")
    );

    // Formatting mocks
    (weekHelpers.getShortWeekday as jest.Mock).mockImplementation((d: Date) =>
      d.toLocaleDateString("en-US", { weekday: "short" })
    );
    (weekHelpers.getDateNumberPadded as jest.Mock).mockImplementation(
      (d: Date) => String(d.getDate()).padStart(2, "0")
    );

    // Comparison mock (true if timestamps match)
    (helpers.isSameDay as jest.Mock).mockImplementation(
      (d1: Date, d2: Date) => d1.getTime() === d2.getTime()
    );
  });

  // --- 1. Rendering ---

  it("renders the correct month, days, and time slots", () => {
    render(
      <Slotpicker
        selectedDate={initialDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={mockTimeSlots}
      />
    );

    // Header: Month Name (October)
    expect(screen.getByText("October")).toBeInTheDocument();

    // Week Days (Sun, Mon...)
    expect(screen.getByText("Sun")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument(); // Date number

    // Time Slots
    expect(screen.getByText("10:00 AM")).toBeInTheDocument();
  });

  it("highlights the selected date and time", () => {
    // Mock isSameDay to return true for the first day (Sun 15)
    (helpers.isSameDay as jest.Mock).mockReturnValueOnce(true);

    render(
      <Slotpicker
        selectedDate={initialDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={mockTimeSlots[0]} // 10:00 AM selected
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={mockTimeSlots}
      />
    );

    // Check Day Highlight
    const dayBtn = screen.getByText("15").closest("button");
    expect(dayBtn?.className).toContain("text-[#247AED]");
    expect(dayBtn?.className).toContain("bg-[#E9F2FD]");

    // Check Time Highlight
    const timeBtn = screen.getByText("10:00 AM").closest("button");
    expect(timeBtn?.className).toContain("bg-[#E9F2FD]");

    // Check Non-highlighted Time
    const otherTimeBtn = screen.getByText("12:00 PM").closest("button");
    expect(otherTimeBtn?.className).not.toContain("bg-[#E9F2FD]");
  });

  // --- 2. Month Navigation ---

  it("navigates to previous month", () => {
    render(
      <Slotpicker
        selectedDate={initialDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={mockTimeSlots}
      />
    );

    (weekHelpers.getStartOfWeek as jest.Mock).mockClear();

    const prevMonthBtn = screen.getAllByTestId("icon-prev")[0];
    fireEvent.click(prevMonthBtn);

    expect(weekHelpers.getStartOfWeek).toHaveBeenCalledWith(expect.any(Date));
    const calledDate = (weekHelpers.getStartOfWeek as jest.Mock).mock
      .calls[0][0];
    expect(calledDate.getMonth()).toBe(8); // September
  });

  it("navigates to next month", () => {
    render(
      <Slotpicker
        selectedDate={initialDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={mockTimeSlots}
      />
    );

    (weekHelpers.getStartOfWeek as jest.Mock).mockClear();

    const nextMonthBtn = screen.getAllByTestId("icon-next")[0];
    fireEvent.click(nextMonthBtn);

    const calledDate = (weekHelpers.getStartOfWeek as jest.Mock).mock
      .calls[0][0];
    expect(calledDate.getMonth()).toBe(10); // November
  });

  // --- 3. Week Navigation ---

  it("navigates to previous week", () => {
    render(
      <Slotpicker
        selectedDate={initialDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={mockTimeSlots}
      />
    );

    const prevWeekBtn = screen.getAllByTestId("icon-prev")[1];
    fireEvent.click(prevWeekBtn);

    expect(weekHelpers.getPrevWeek).toHaveBeenCalledWith(weekStartDate);
  });

  it("navigates to next week", () => {
    render(
      <Slotpicker
        selectedDate={initialDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={mockTimeSlots}
      />
    );

    const nextWeekBtn = screen.getAllByTestId("icon-next")[1];
    fireEvent.click(nextWeekBtn);

    expect(weekHelpers.getNextWeek).toHaveBeenCalledWith(weekStartDate);
  });

  // --- 4. Selection Interaction ---

  it("calls setSelectedDate when a day is clicked", () => {
    render(
      <Slotpicker
        selectedDate={initialDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={mockTimeSlots}
      />
    );

    const dayBtn = screen.getAllByText(/[0-9]{2}/)[1].closest("button");
    fireEvent.click(dayBtn!);

    expect(mockSetSelectedDate).toHaveBeenCalledWith(mockDays[1]);
  });

  it("calls setSelectedSlot when a time slot is clicked", () => {
    render(
      <Slotpicker
        selectedDate={initialDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={mockTimeSlots}
      />
    );

    const slotBtn = screen.getByText("12:00 PM");
    fireEvent.click(slotBtn);

    expect(mockSetSelectedSlot).toHaveBeenCalledWith(mockTimeSlots[1]);
  });

  it("updates view when selectedDate prop changes externally", () => {
    const { rerender } = render(
      <Slotpicker
        selectedDate={initialDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={mockTimeSlots}
      />
    );

    (weekHelpers.getStartOfWeek as jest.Mock).mockClear();

    const newDate = new Date("2023-12-25T12:00:00Z");
    rerender(
      <Slotpicker
        selectedDate={newDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={mockTimeSlots}
      />
    );

    expect(weekHelpers.getStartOfWeek).toHaveBeenCalledWith(newDate);
  });
});
