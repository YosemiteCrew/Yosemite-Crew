import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import TaskSlot from "@/app/components/Calendar/Task/TaskSlot";
import { TasksProps } from "@/app/types/tasks";

// --- Mocks ---

jest.mock("@/app/components/DataTable/Tasks", () => ({
  getStatusStyle: jest.fn(() => ({ backgroundColor: "rgb(0, 0, 255)" })), // Returns blue for test
}));

// --- Test Data ---

const mockDate = new Date("2023-01-01T12:00:00Z");
const mockEvents: TasksProps[] = [
  {
    _id: "1",
    task: "Task Alpha",
    to: "Assignee A",
    status: "Pending",
    due: mockDate,
  } as any,
  {
    _id: "2",
    task: "Task Beta",
    to: "Assignee B",
    status: "Done",
    due: mockDate,
  } as any,
];

describe("TaskSlot Component", () => {
  const mockHandleViewTask = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering ---

  it("renders a list of tasks when events are provided", () => {
    render(
      <TaskSlot
        slotEvents={mockEvents}
        handleViewTask={mockHandleViewTask}
        dayIndex={0}
      />
    );

    // Verify task content
    expect(screen.getByText("Task Alpha")).toBeInTheDocument();
    expect(screen.getByText("Assignee A")).toBeInTheDocument();
    expect(screen.getByText("Task Beta")).toBeInTheDocument();

    // Verify styling is applied via the mock
    const taskButton = screen.getByText("Task Alpha").closest("button");
    expect(taskButton).toHaveStyle("background-color: rgb(0, 0, 255)");
  });

  it("renders empty state message when slotEvents is empty", () => {
    render(
      <TaskSlot
        slotEvents={[]}
        handleViewTask={mockHandleViewTask}
        dayIndex={0}
      />
    );

    expect(screen.getByText("No tasks available")).toBeInTheDocument();
    expect(screen.queryByText("Task Alpha")).not.toBeInTheDocument();
  });

  // --- 2. Interaction ---

  it("calls handleViewTask with correct task object on click", () => {
    render(
      <TaskSlot
        slotEvents={mockEvents}
        handleViewTask={mockHandleViewTask}
        dayIndex={0}
      />
    );

    const taskButton = screen.getByText("Task Beta").closest("button");
    fireEvent.click(taskButton!);

    expect(mockHandleViewTask).toHaveBeenCalledTimes(1);
    expect(mockHandleViewTask).toHaveBeenCalledWith(mockEvents[1]);
  });
});
