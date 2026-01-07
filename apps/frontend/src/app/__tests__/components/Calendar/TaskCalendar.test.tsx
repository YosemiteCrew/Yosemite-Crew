import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import TaskCalendar from "@/app/components/Calendar/TaskCalendar";
import { Task } from "@/app/types/task";

// --- Mocks ---

// Mock Helper
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

jest.mock("@/app/components/Calendar/Task/DayCalendar", () => {
  return function MockDayCalendar(props: any) {
    return (
      <div data-testid="day-calendar">
        Day View
        <ul>
          {props.events.map((e: any) => (
            <li key={e._id}>
              <button
                data-testid={`day-task-${e._id}`}
                onClick={() => props.handleViewTask(e)}
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

jest.mock("@/app/components/Calendar/Task/WeekCalendar", () => {
  return function MockWeekCalendar(props: any) {
    return (
      <div data-testid="week-calendar">
        Week View
        <ul>
          {props.events.map((e: any) => (
            <li key={e._id}>
              <button
                data-testid={`week-task-${e._id}`}
                onClick={() => props.handleViewTask(e)}
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
const mockTasks: Task[] = [
  { _id: "1", title: "Task 1", dueAt: new Date("2023-01-01T10:00:00Z") } as any,
  { _id: "2", title: "Task 2", dueAt: new Date("2023-01-02T10:00:00Z") } as any,
];

describe("TaskCalendar Component", () => {
  const mockSetActiveTask = jest.fn();
  const mockSetViewPopup = jest.fn();
  const mockSetCurrentDate = jest.fn();
  const mockSetWeekStart = jest.fn();

  const defaultProps = {
    filteredList: mockTasks,
    setActiveTask: mockSetActiveTask,
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
    render(<TaskCalendar {...defaultProps} />);
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByText(/Header - Current:/)).toBeInTheDocument();
  });

  it("filters tasks correctly for Day View using useMemo", () => {
    // isSameDay mock returns true only for "2023-01-01"
    // So only Task 1 should appear in Day View
    render(<TaskCalendar {...defaultProps} activeCalendar="day" />);

    expect(screen.getByTestId("day-calendar")).toBeInTheDocument();
    expect(screen.getByTestId("day-task-1")).toBeInTheDocument();
    expect(screen.queryByTestId("day-task-2")).not.toBeInTheDocument();
  });

  // --- 2. View Switching ---

  it("renders DayCalendar when activeCalendar is 'day'", () => {
    render(<TaskCalendar {...defaultProps} activeCalendar="day" />);
    expect(screen.getByTestId("day-calendar")).toBeInTheDocument();
    expect(screen.queryByTestId("week-calendar")).not.toBeInTheDocument();
  });

  it("renders WeekCalendar when activeCalendar is 'week'", () => {
    render(<TaskCalendar {...defaultProps} activeCalendar="week" />);
    expect(screen.getByTestId("week-calendar")).toBeInTheDocument();
    expect(screen.queryByTestId("day-calendar")).not.toBeInTheDocument();

    // Week view receives FULL list
    expect(screen.getByTestId("week-task-1")).toBeInTheDocument();
    expect(screen.getByTestId("week-task-2")).toBeInTheDocument();
  });

  it("renders nothing (besides header) if activeCalendar is invalid", () => {
    render(<TaskCalendar {...defaultProps} activeCalendar="month" />);
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.queryByTestId("day-calendar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("week-calendar")).not.toBeInTheDocument();
  });

  // --- 3. Interactions ---

  it("handles viewing a task from Day View", () => {
    render(<TaskCalendar {...defaultProps} activeCalendar="day" />);

    const task = screen.getByTestId("day-task-1");
    fireEvent.click(task);

    expect(mockSetActiveTask).toHaveBeenCalledWith(mockTasks[0]);
    expect(mockSetViewPopup).toHaveBeenCalledWith(true);
  });

  it("handles viewing a task from Week View", () => {
    render(<TaskCalendar {...defaultProps} activeCalendar="week" />);

    const task = screen.getByTestId("week-task-2");
    fireEvent.click(task);

    expect(mockSetActiveTask).toHaveBeenCalledWith(mockTasks[1]);
    expect(mockSetViewPopup).toHaveBeenCalledWith(true);
  });

  it("passes setCurrentDate prop down to Header correctly", () => {
    render(<TaskCalendar {...defaultProps} />);

    const changeBtn = screen.getByText("Change Date");
    fireEvent.click(changeBtn);

    expect(mockSetCurrentDate).toHaveBeenCalled();
  });

  // --- 4. Optional Props ---

  it("handles missing optional callbacks safely", () => {
    render(
      <TaskCalendar
        {...defaultProps}
        setActiveTask={undefined}
        setViewPopup={undefined}
      />
    );

    const task = screen.getByTestId("day-task-1");
    fireEvent.click(task);

    // Should not crash
    expect(mockSetActiveTask).not.toHaveBeenCalled();
    expect(mockSetViewPopup).not.toHaveBeenCalled();
  });
});
