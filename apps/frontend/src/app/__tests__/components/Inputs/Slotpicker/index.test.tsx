import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Slotpicker from "@/app/components/Inputs/Slotpicker";
import { Slot } from "@/app/types/appointments";
import * as weekHelpers from "@/app/components/Calendar/weekHelpers";

// --- Mocks ---

// Mock helper functions from weekHelpers using the absolute path
jest.mock("@/app/components/Calendar/weekHelpers", () => ({
  __esModule: true,
  // Use requireActual with the alias to ensure we get the real implementation where needed
  ...jest.requireActual("@/app/components/Calendar/weekHelpers"),
  getStartOfWeek: jest.fn(),
  getWeekDays: jest.fn(),
  getPrevWeek: jest.fn(),
  getNextWeek: jest.fn(),
  // Simple implementations for display logic
  getShortWeekday: (d: Date) =>
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()],
  getDateNumberPadded: (d: Date) => String(d.getDate()).padStart(2, "0"),
}));

// Mock utils using the absolute path
jest.mock("@/app/components/Availability/utils", () => ({
  formatUtcTimeToLocalLabel: (time: string) => `Formatted ${time}`,
}));

// Mock icons
jest.mock("react-icons/gr", () => ({
  GrNext: ({ onClick }: any) => (
    <button data-testid="next-btn" onClick={onClick}>
      Next
    </button>
  ),
  GrPrevious: ({ onClick }: any) => (
    <button data-testid="prev-btn" onClick={onClick}>
      Prev
    </button>
  ),
}));

describe("Slotpicker Component", () => {
  // Test Data Setup
  const mockSetSelectedDate = jest.fn();
  const mockSetSelectedSlot = jest.fn();

  // specific date for consistent testing: Wednesday, Oct 11, 2023
  const baseDate = new Date("2023-10-11T12:00:00Z");
  const startOfWeek = new Date("2023-10-08T00:00:00Z"); // Sunday Oct 8

  // FIX: Added vetIds: [] to satisfy the Slot type definition
  const mockTimeSlots: Slot[] = [
    { startTime: "10:00", endTime: "10:30", vetIds: [] },
    { startTime: "11:00", endTime: "11:30", vetIds: [] },
  ];

  // A full week of date objects relative to the baseDate
  const weekDays = [
    new Date("2023-10-08T00:00:00Z"),
    new Date("2023-10-09T00:00:00Z"),
    new Date("2023-10-10T00:00:00Z"),
    new Date("2023-10-11T00:00:00Z"), // Current Selected (Wed)
    new Date("2023-10-12T00:00:00Z"),
    new Date("2023-10-13T00:00:00Z"),
    new Date("2023-10-14T00:00:00Z"),
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations for helpers
    (weekHelpers.getStartOfWeek as jest.Mock).mockReturnValue(startOfWeek);
    (weekHelpers.getWeekDays as jest.Mock).mockReturnValue(weekDays);

    // Mock week navigation logic simply by manipulating date
    (weekHelpers.getPrevWeek as jest.Mock).mockImplementation((d) => {
      const newD = new Date(d);
      newD.setDate(newD.getDate() - 7);
      return newD;
    });
    (weekHelpers.getNextWeek as jest.Mock).mockImplementation((d) => {
      const newD = new Date(d);
      newD.setDate(newD.getDate() + 7);
      return newD;
    });

    // Freeze system time to baseDate so "isPastDay" logic is deterministic
    jest.useFakeTimers();
    jest.setSystemTime(baseDate);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // --- Tests ---

  it("renders correctly with initial props", () => {
    render(
      <Slotpicker
        selectedDate={baseDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={mockTimeSlots}
      />
    );

    // Check Month Header
    expect(screen.getByText("October")).toBeInTheDocument();

    // Check Week Days
    weekDays.forEach((day) => {
      expect(
        screen.getByText(String(day.getDate()).padStart(2, "0"))
      ).toBeInTheDocument();
    });

    // Check Time Slots
    expect(screen.getByText("Formatted 10:00")).toBeInTheDocument();
    expect(screen.getByText("Formatted 11:00")).toBeInTheDocument();
  });

  it("highlights the selected date correctly", () => {
    // Render with Oct 11 selected
    render(
      <Slotpicker
        selectedDate={weekDays[3]}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={[]}
      />
    );

    // 11 is selected, 10 is not
    const selectedDayBtn = screen.getByText("11").closest("button");
    const otherDayBtn = screen.getByText("10").closest("button");

    expect(selectedDayBtn).toHaveClass("text-[#247AED]");
    expect(otherDayBtn).not.toHaveClass("text-[#247AED]");
  });

  it("highlights the selected slot correctly", () => {
    const selectedSlot = mockTimeSlots[0];
    render(
      <Slotpicker
        selectedDate={baseDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={selectedSlot}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={mockTimeSlots}
      />
    );

    const selectedBtn = screen.getByText("Formatted 10:00");
    const unselectedBtn = screen.getByText("Formatted 11:00");

    expect(selectedBtn).toHaveClass("text-[#247AED]");
    expect(unselectedBtn).not.toHaveClass("text-[#247AED]");
  });

  it("calls setSelectedSlot when a slot is clicked", () => {
    render(
      <Slotpicker
        selectedDate={baseDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={mockTimeSlots}
      />
    );

    fireEvent.click(screen.getByText("Formatted 11:00"));
    expect(mockSetSelectedSlot).toHaveBeenCalledWith(mockTimeSlots[1]);
  });

  it("calls setSelectedDate and resets slot when a valid future/current date is clicked", () => {
    // Current date is Oct 11. Clicking Oct 12 (Future)
    render(
      <Slotpicker
        selectedDate={baseDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={mockTimeSlots}
      />
    );

    const futureDateBtn = screen.getByText("12").closest("button");
    fireEvent.click(futureDateBtn!);

    expect(mockSetSelectedDate).toHaveBeenCalledWith(weekDays[4]);
    expect(mockSetSelectedSlot).toHaveBeenCalledWith(null);
  });

  it("does NOT call setSelectedDate when a past date is clicked", () => {
    // Current date (system time) is Oct 11. Clicking Oct 09 (Past)
    render(
      <Slotpicker
        selectedDate={baseDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={mockTimeSlots}
      />
    );

    const pastDateBtn = screen.getByText("09").closest("button");
    fireEvent.click(pastDateBtn!);

    expect(mockSetSelectedDate).not.toHaveBeenCalled();
    expect(mockSetSelectedSlot).not.toHaveBeenCalled();
  });

  it("navigates to the previous week", () => {
    render(
      <Slotpicker
        selectedDate={baseDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={[]}
      />
    );

    // Index 0: Month Navigation, Index 1: Week Navigation
    const prevButtons = screen.getAllByTestId("prev-btn");
    const prevWeekBtn = prevButtons[1];

    fireEvent.click(prevWeekBtn);

    expect(weekHelpers.getPrevWeek).toHaveBeenCalled();
  });

  it("navigates to the next week", () => {
    render(
      <Slotpicker
        selectedDate={baseDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={[]}
      />
    );

    const nextButtons = screen.getAllByTestId("next-btn");
    const nextWeekBtn = nextButtons[1];

    fireEvent.click(nextWeekBtn);

    expect(weekHelpers.getNextWeek).toHaveBeenCalled();
  });

  it("navigates to the previous month", () => {
    render(
      <Slotpicker
        selectedDate={baseDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={[]}
      />
    );

    // Month Navigation (index 0)
    const prevButtons = screen.getAllByTestId("prev-btn");
    const prevMonthBtn = prevButtons[0];

    fireEvent.click(prevMonthBtn);

    expect(weekHelpers.getStartOfWeek).toHaveBeenCalled();
    const callArgs = (weekHelpers.getStartOfWeek as jest.Mock).mock.calls;
    // FIX: Use .at(-1) for SonarQube compliance (S7755)
    const dateArg = callArgs.at(-1)![0];
    expect(dateArg.getMonth()).toBe(8); // September
  });

  it("navigates to the next month", () => {
    render(
      <Slotpicker
        selectedDate={baseDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={[]}
      />
    );

    // Month Navigation (index 0)
    const nextButtons = screen.getAllByTestId("next-btn");
    const nextMonthBtn = nextButtons[0];

    fireEvent.click(nextMonthBtn);

    expect(weekHelpers.getStartOfWeek).toHaveBeenCalled();
    const callArgs = (weekHelpers.getStartOfWeek as jest.Mock).mock.calls;
    // FIX: Use .at(-1) for SonarQube compliance (S7755)
    const dateArg = callArgs.at(-1)![0];
    expect(dateArg.getMonth()).toBe(10); // November
  });

  it("updates view when selectedDate prop changes from parent", () => {
    const { rerender } = render(
      <Slotpicker
        selectedDate={baseDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={[]}
      />
    );

    expect(weekHelpers.getStartOfWeek).toHaveBeenCalledWith(baseDate);

    const newDate = new Date("2023-12-25T12:00:00Z");
    rerender(
      <Slotpicker
        selectedDate={newDate}
        setSelectedDate={mockSetSelectedDate}
        selectedSlot={null}
        setSelectedSlot={mockSetSelectedSlot}
        timeSlots={[]}
      />
    );

    expect(weekHelpers.getStartOfWeek).toHaveBeenCalledWith(newDate);
  });
});
