import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import TaskCard from "@/app/components/Cards/TaskCard";
import { Task } from "@/app/types/task";

// --- Mocks ---

jest.mock("@/app/components/DataTable/Tasks", () => ({
  getStatusStyle: jest.fn(() => ({ color: "green" })),
}));

jest.mock("@/app/components/Calendar/weekHelpers", () => ({
  getFormattedDate: jest.fn((date: any) => `Formatted ${String(date)}`),
}));

import { getFormattedDate } from "@/app/components/Calendar/weekHelpers";

const mockTask: Task = {
  _id: "task-1",
  name: "Order supplies",
  description: "Buy gloves and masks",
  category: "Admin",
  assignedBy: "Alice",
  assignedTo: "Bob",
  audience: "EMPLOYEE_TASK",
  source: "CUSTOM",
  dueAt: new Date("2025-01-10T00:00:00.000Z"),
  status: "IN_PROGRESS",
} as any;

describe("TaskCard Component", () => {
  const mockHandleView = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders task details correctly", () => {
    render(<TaskCard item={mockTask} handleViewTask={mockHandleView} />);

    // Header
    expect(screen.getByText("Order supplies")).toBeInTheDocument();

    // Description
    expect(screen.getByText("Description:")).toBeInTheDocument();
    expect(screen.getByText("Buy gloves and masks")).toBeInTheDocument();

    // Category
    expect(screen.getByText("Category:")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();

    // From / To
    expect(screen.getByText("From:")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();

    expect(screen.getByText("To:")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();

    // Due date (formatter)
    expect(getFormattedDate).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Formatted/)).toBeInTheDocument();

    // Status badge text
    expect(screen.getByText("IN_PROGRESS")).toBeInTheDocument();

    // View button exists
    expect(screen.getByText("View")).toBeInTheDocument();
  });

  it("handles missing optional fields gracefully", () => {
    const incompleteTask: Task = {
      ...mockTask,
      description: undefined,
      assignedBy: undefined,
    } as any;

    render(<TaskCard item={incompleteTask} handleViewTask={mockHandleView} />);

    // Still renders labels and doesn't crash
    expect(screen.getByText("Description:")).toBeInTheDocument();
    expect(screen.getByText("Category:")).toBeInTheDocument();
    expect(screen.getByText("From:")).toBeInTheDocument();
    expect(screen.getByText("To:")).toBeInTheDocument();
    expect(screen.getByText("Due date:")).toBeInTheDocument();
    expect(screen.getByText("IN_PROGRESS")).toBeInTheDocument();
  });

  it("calls handleViewTask with the task when clicking View", () => {
    render(<TaskCard item={mockTask} handleViewTask={mockHandleView} />);

    fireEvent.click(screen.getByText("View"));

    expect(mockHandleView).toHaveBeenCalledTimes(1);
    expect(mockHandleView).toHaveBeenCalledWith(expect.objectContaining({ _id: "task-1" }));
  });
});
