import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import DayCalendar from "@/app/components/Calendar/Task/DayCalendar";
import { TasksProps } from "@/app/types/tasks";

// --- Mocks ---

// Mock Helpers
jest.mock("@/app/components/Calendar/helpers", () => ({
  getDayWithDate: jest.fn((date: Date) => `Mocked Date ${date.getDate()}`),
}));

jest.mock("@/app/components/DataTable/Tasks", () => ({
  getStatusStyle: jest.fn(() => ({ backgroundColor: "red" })),
}));

import { getDayWithDate } from "@/app/components/Calendar/helpers";

// --- Test Data ---

const mockDate = new Date("2023-01-15T00:00:00.000Z");

const mockTasks: TasksProps[] = [
  {
    _id: "1",
    task: "Task One",
    to: "Assignee A",
    status: "Pending",
    due: new Date(),
  } as any,
  {
    _id: "2",
    task: "Task Two",
    to: "Assignee B",
    status: "Done",
    due: new Date(),
  } as any,
];

describe("Task DayCalendar Component", () => {
  const mockHandleViewTask = jest.fn();
  const mockSetCurrentDate = jest.fn();

  const defaultProps = {
    events: mockTasks,
    date: mockDate,
    handleViewTask: mockHandleViewTask,
    setCurrentDate: mockSetCurrentDate,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering ---

  it("renders the header with formatted date", () => {
    render(<DayCalendar {...defaultProps} />);

    // Expect the mocked date string
    expect(screen.getByText("Mocked Date 15")).toBeInTheDocument();
    expect(getDayWithDate).toHaveBeenCalledWith(mockDate);
  });

  it("renders a list of tasks when events are provided", () => {
    render(<DayCalendar {...defaultProps} />);

    // Check Task content
    expect(screen.getByText("Task One")).toBeInTheDocument();
    expect(screen.getByText("Assignee A")).toBeInTheDocument();

    expect(screen.getByText("Task Two")).toBeInTheDocument();
    expect(screen.getByText("Assignee B")).toBeInTheDocument();
  });

  it("renders empty state message when no events exist", () => {
    render(<DayCalendar {...defaultProps} events={[]} />);

    expect(
      screen.getByText("No tasks available for today")
    ).toBeInTheDocument();
    expect(screen.queryByText("Task One")).not.toBeInTheDocument();
  });

  // --- 2. Navigation ---

  it("handles Next Day navigation", () => {
    render(<DayCalendar {...defaultProps} />);

    // Find Next Arrow (second SVG in the header usually, or query by SVG presence)
    // Since we used react-icons, they render as SVGs.
    // The component structure is Prev Icon -> Date -> Next Icon.
    const icons = document.querySelectorAll("svg");
    const nextBtn = icons[1]; // Second icon

    fireEvent.click(nextBtn);

    expect(mockSetCurrentDate).toHaveBeenCalledTimes(1);

    // Verify the state update function logic
    const updateFn = mockSetCurrentDate.mock.calls[0][0];
    const prevDate = new Date("2023-01-15");
    const newDate = updateFn(prevDate);

    expect(newDate.getDate()).toBe(16); // 15 + 1
  });

  it("handles Previous Day navigation", () => {
    render(<DayCalendar {...defaultProps} />);

    const icons = document.querySelectorAll("svg");
    const prevBtn = icons[0]; // First icon

    fireEvent.click(prevBtn);

    expect(mockSetCurrentDate).toHaveBeenCalledTimes(1);

    // Verify the state update function logic
    const updateFn = mockSetCurrentDate.mock.calls[0][0];
    const prevDate = new Date("2023-01-15");
    const newDate = updateFn(prevDate);

    expect(newDate.getDate()).toBe(14); // 15 - 1
  });

  // --- 3. Interactions ---

  it("calls handleViewTask when a task item is clicked", () => {
    render(<DayCalendar {...defaultProps} />);

    const taskButton = screen.getByText("Task One").closest("button");
    fireEvent.click(taskButton!);

    expect(mockHandleViewTask).toHaveBeenCalledWith(mockTasks[0]);
  });
});
