import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import DayCalendar from "@/app/components/Calendar/Task/DayCalendar";
import { Task } from "@/app/types/task";

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: jest.fn(),
}));

jest.mock("@/app/components/DataTable/Tasks", () => ({
  getStatusStyle: jest.fn(() => ({ backgroundColor: "purple", color: "white" })),
}));

jest.mock("@/app/components/Icons/Back", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Prev
    </button>
  ),
}));

jest.mock("@/app/components/Icons/Next", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Next
    </button>
  ),
}));

import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";

describe("DayCalendar (Task)", () => {
  const handleViewTask = jest.fn();
  const setCurrentDate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: "user-1", name: "Taylor" },
    ]);
  });

  it("renders tasks and resolves assigned member names", () => {
    const events: Task[] = [
      {
        name: "Morning Task",
        dueAt: new Date("2025-01-06T10:00:00Z"),
        status: "pending",
        assignedTo: "user-1",
      } as Task,
      {
        name: "Unassigned Task",
        dueAt: new Date("2025-01-06T11:00:00Z"),
        status: "completed",
      } as Task,
    ];

    render(
      <DayCalendar
        events={events}
        date={new Date(2025, 0, 6, 12)}
        handleViewTask={handleViewTask}
        setCurrentDate={setCurrentDate}
      />
    );

    expect(screen.getByText("Morning Task")).toBeInTheDocument();
    expect(screen.getByText("Taylor")).toBeInTheDocument();
    expect(screen.getByText("Unassigned Task")).toBeInTheDocument();
    expect(screen.getByText("-")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Morning Task").closest("button")!);
    expect(handleViewTask).toHaveBeenCalledWith(events[0]);
  });

  it("shows empty state when no tasks are available", () => {
    render(
      <DayCalendar
        events={[]}
        date={new Date(2025, 0, 6, 12)}
        handleViewTask={handleViewTask}
        setCurrentDate={setCurrentDate}
      />
    );

    expect(
      screen.getByText("No tasks available for today")
    ).toBeInTheDocument();
  });

  it("advances and rewinds the current date", () => {
    render(
      <DayCalendar
        events={[]}
        date={new Date(2025, 0, 6, 12)}
        handleViewTask={handleViewTask}
        setCurrentDate={setCurrentDate}
      />
    );

    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Prev"));

    expect(setCurrentDate).toHaveBeenCalledTimes(2);

    const nextFn = setCurrentDate.mock.calls[0][0];
    const prevFn = setCurrentDate.mock.calls[1][0];

    expect(nextFn(new Date(2025, 0, 6)).getDate()).toBe(7);
    expect(prevFn(new Date(2025, 0, 6)).getDate()).toBe(5);
  });
});
