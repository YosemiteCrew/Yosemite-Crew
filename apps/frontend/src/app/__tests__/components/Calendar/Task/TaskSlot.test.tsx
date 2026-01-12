import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import TaskSlot from "@/app/components/Calendar/Task/TaskSlot";
import { Task } from "@/app/types/task";

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: jest.fn(),
}));

jest.mock("@/app/components/DataTable/Tasks", () => ({
  getStatusStyle: jest.fn(() => ({ backgroundColor: "pink", color: "white" })),
}));

import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";

describe("TaskSlot", () => {
  const handleViewTask = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: "user-1", name: "Alex" },
    ]);
  });

  it("renders tasks with member names and triggers view handler", () => {
    const slotEvents: Task[] = [
      {
        name: "Task A",
        dueAt: new Date("2025-01-06T10:00:00Z"),
        status: "pending",
        assignedTo: "user-1",
      } as Task,
      {
        name: "Task B",
        dueAt: new Date("2025-01-06T11:00:00Z"),
        status: "completed",
      } as Task,
    ];

    render(
      <TaskSlot
        slotEvents={slotEvents}
        handleViewTask={handleViewTask}
        index={0}
        length={1}
        height={200}
      />
    );

    expect(screen.getByText("Task A")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("Task B")).toBeInTheDocument();
    expect(screen.getByText("-")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Task A").closest("button")!);
    expect(handleViewTask).toHaveBeenCalledWith(slotEvents[0]);

    const container = screen.getByText("Task A").closest("button")!.parentElement;
    expect(container).toHaveStyle("height: 200px");
  });

  it("renders empty state when no tasks exist", () => {
    render(
      <TaskSlot
        slotEvents={[]}
        handleViewTask={handleViewTask}
        index={1}
        length={1}
        height={180}
      />
    );

    const emptyState = screen.getByText("No tasks available");
    expect(emptyState).toBeInTheDocument();
    expect(emptyState).toHaveStyle("height: 180px");
  });
});
