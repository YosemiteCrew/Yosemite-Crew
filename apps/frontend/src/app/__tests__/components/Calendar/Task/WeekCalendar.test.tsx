import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import WeekCalendar from "@/app/components/Calendar/Task/WeekCalendar";
import { TasksProps } from "@/app/types/tasks";

// --- Mocks ---

// Mock Helpers
jest.mock("@/app/components/Calendar/weekHelpers", () => ({
  getWeekDays: jest.fn(() => [
    new Date("2023-01-01"),
    new Date("2023-01-02"),
    new Date("2023-01-03"),
    new Date("2023-01-04"),
    new Date("2023-01-05"),
    new Date("2023-01-06"),
    new Date("2023-01-07"),
  ]),
  getPrevWeek: jest.fn(
    (d: Date) => new Date(d.getTime() - 7 * 24 * 60 * 60 * 1000)
  ),
  getNextWeek: jest.fn(
    (d: Date) => new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000)
  ),
}));

jest.mock("@/app/components/Calendar/helpers", () => ({
  eventsForDay: jest.fn((events, day) => {
    // Return dummy event if day is Jan 1st
    if (day.getDate() === 1) return events;
    return [];
  }),
}));

import {
  getWeekDays,
  getPrevWeek,
  getNextWeek,
} from "@/app/components/Calendar/weekHelpers";
import { eventsForDay } from "@/app/components/Calendar/helpers";

// Mock Child Components
jest.mock("@/app/components/Calendar/common/DayLabels", () => {
  return function MockDayLabels(props: any) {
    return (
      <div data-testid="day-labels">
        <button onClick={props.onPrevWeek} data-testid="btn-prev">
          Prev
        </button>
        <button onClick={props.onNextWeek} data-testid="btn-next">
          Next
        </button>
        <span>Days Count: {props.days.length}</span>
      </div>
    );
  };
});

jest.mock("@/app/components/Calendar/Task/TaskSlot", () => {
  return function MockTaskSlot(props: any) {
    return (
      <div data-testid="task-slot">
        Slot {props.dayIndex} - Events: {props.slotEvents.length}
      </div>
    );
  };
});

// --- Test Data ---

const mockDate = new Date("2023-01-01T00:00:00.000Z");
const mockEvents: TasksProps[] = [{ _id: "1", title: "Task 1" } as any];

describe("Task WeekCalendar Component", () => {
  const mockHandleViewTask = jest.fn();
  const mockSetWeekStart = jest.fn();
  const mockSetCurrentDate = jest.fn();

  const defaultProps = {
    events: mockEvents,
    date: mockDate,
    handleViewTask: mockHandleViewTask,
    weekStart: mockDate,
    setWeekStart: mockSetWeekStart,
    setCurrentDate: mockSetCurrentDate,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering & Logic ---

  it("renders DayLabels and TaskSlots correctly", () => {
    render(<WeekCalendar {...defaultProps} />);

    // Check DayLabels rendered
    expect(screen.getByTestId("day-labels")).toBeInTheDocument();
    expect(screen.getByText("Days Count: 7")).toBeInTheDocument();

    // Check getWeekDays was called
    expect(getWeekDays).toHaveBeenCalledWith(mockDate);

    // Check TaskSlots rendered (7 slots for the week)
    const slots = screen.getAllByTestId("task-slot");
    expect(slots).toHaveLength(7);

    // Verify data flow to slots (eventsForDay mock returns events only for Jan 1st - index 0)
    expect(slots[0]).toHaveTextContent("Events: 1");
    expect(slots[1]).toHaveTextContent("Events: 0");

    // Verify eventsForDay helper call
    expect(eventsForDay).toHaveBeenCalledTimes(7);
  });

  // --- 2. Navigation Handlers ---

  it("handles Previous Week navigation", () => {
    render(<WeekCalendar {...defaultProps} />);

    const prevBtn = screen.getByTestId("btn-prev");
    fireEvent.click(prevBtn);

    // 1. Expect setWeekStart to be called
    expect(mockSetWeekStart).toHaveBeenCalled();

    // 2. Simulate the state update function passed to setWeekStart
    const updateFn = mockSetWeekStart.mock.calls[0][0];
    const prevDate = new Date("2023-01-08"); // Arbitrary date for calculation
    const calculatedNewDate = updateFn(prevDate);

    // 3. Verify helper usage and side-effect (setCurrentDate)
    expect(getPrevWeek).toHaveBeenCalledWith(prevDate);
    expect(mockSetCurrentDate).toHaveBeenCalledWith(calculatedNewDate);

    // Check returned date is correct based on mock logic
    expect(calculatedNewDate.getTime()).toBeLessThan(prevDate.getTime());
  });

  it("handles Next Week navigation", () => {
    render(<WeekCalendar {...defaultProps} />);

    const nextBtn = screen.getByTestId("btn-next");
    fireEvent.click(nextBtn);

    // 1. Expect setWeekStart to be called
    expect(mockSetWeekStart).toHaveBeenCalled();

    // 2. Simulate the state update function passed to setWeekStart
    const updateFn = mockSetWeekStart.mock.calls[0][0];
    const prevDate = new Date("2023-01-01");
    const calculatedNewDate = updateFn(prevDate);

    // 3. Verify helper usage and side-effect (setCurrentDate)
    expect(getNextWeek).toHaveBeenCalledWith(prevDate);
    expect(mockSetCurrentDate).toHaveBeenCalledWith(calculatedNewDate);

    // Check returned date is correct based on mock logic
    expect(calculatedNewDate.getTime()).toBeGreaterThan(prevDate.getTime());
  });
});
