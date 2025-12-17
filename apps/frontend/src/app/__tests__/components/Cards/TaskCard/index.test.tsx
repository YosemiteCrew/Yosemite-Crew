import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import TaskCard from "@/app/components/Cards/TaskCard";
import { TasksProps } from "@/app/types/tasks";

// --- Mocks ---

jest.mock("@/app/components/DataTable/Tasks", () => ({
  getStatusStyle: jest.fn(() => ({ color: "orange" })),
}));

jest.mock("@/app/components/Calendar/weekHelpers", () => ({
  getFormattedDate: jest.fn(() => "Jan 01, 2024"),
}));

import { getFormattedDate } from "@/app/components/Calendar/weekHelpers";

// --- Test Data ---

const mockTask: TasksProps = {
  _id: "task-1",
  task: "Weekly Report",
  description: "Compile sales numbers",
  category: "Admin",
  from: "Manager A",
  to: "Director B",
  due: new Date("2024-01-01"),
  status: "In Progress",
} as any;

describe("TaskCard Component", () => {
  const mockHandleViewTask = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering Details ---

  it("renders task details correctly", () => {
    render(<TaskCard item={mockTask} handleViewTask={mockHandleViewTask} />);

    // Title
    expect(screen.getByText("Weekly Report")).toBeInTheDocument();

    // Description
    expect(screen.getByText("Description:")).toBeInTheDocument();
    expect(screen.getByText("Compile sales numbers")).toBeInTheDocument();

    // Category
    expect(screen.getByText("Category:")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();

    // From / To
    expect(screen.getByText("From:")).toBeInTheDocument();
    expect(screen.getByText("Manager A")).toBeInTheDocument();
    expect(screen.getByText("To:")).toBeInTheDocument();
    expect(screen.getByText("Director B")).toBeInTheDocument();

    // Due Date (via Helper Mock)
    expect(screen.getByText("Due date:")).toBeInTheDocument();
    expect(getFormattedDate).toHaveBeenCalledWith(mockTask.due);
    expect(screen.getByText("Jan 01, 2024")).toBeInTheDocument();
  });

  // --- 2. Styling Logic ---

  it("applies correct status styling", () => {
    render(<TaskCard item={mockTask} handleViewTask={mockHandleViewTask} />);

    const statusBadge = screen.getByText("In Progress");
    expect(statusBadge).toBeInTheDocument();

    // Check style from mock: JSDOM converts "orange" to "rgb(255, 165, 0)"
    expect(statusBadge).toHaveStyle({ color: "rgb(255, 165, 0)" });
  });

  // --- 3. Interaction ---

  it("calls handleViewTask when View button is clicked", () => {
    render(<TaskCard item={mockTask} handleViewTask={mockHandleViewTask} />);

    const viewBtn = screen.getByText("View");
    fireEvent.click(viewBtn);

    expect(mockHandleViewTask).toHaveBeenCalledTimes(1);
    expect(mockHandleViewTask).toHaveBeenCalledWith(mockTask);
  });
});
