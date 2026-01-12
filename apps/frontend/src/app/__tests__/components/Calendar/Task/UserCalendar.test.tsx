import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import UserCalendar from "@/app/components/Calendar/Task/UserCalendar";
import { Task } from "@/app/types/task";

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: jest.fn(),
}));

const mockEventsForUser = jest.fn();
jest.mock("@/app/components/Calendar/helpers", () => ({
  eventsForUser: (...args: any[]) => mockEventsForUser(...args),
}));

const userLabelsSpy = jest.fn();
jest.mock("@/app/components/Calendar/Task/UserLabels", () => (props: any) => {
  userLabelsSpy(props);
  return <div data-testid="user-labels" />;
});

const taskSlotSpy = jest.fn();
jest.mock("@/app/components/Calendar/Task/TaskSlot", () => (props: any) => {
  taskSlotSpy(props);
  return <div data-testid="task-slot" />;
});

jest.mock("@/app/components/Icons/Back", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      PrevDay
    </button>
  ),
}));

jest.mock("@/app/components/Icons/Next", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      NextDay
    </button>
  ),
}));

import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";

describe("UserCalendar (Task)", () => {
  const handleViewTask = jest.fn();
  const setCurrentDate = jest.fn();

  const team = [
    { _id: "user-1", name: "Avery" },
    { _id: "user-2", name: "Sam" },
  ];
  const events: Task[] = [
    {
      name: "Task A",
      assignedTo: "user-1",
      dueAt: new Date("2025-01-06T10:00:00Z"),
      status: "PENDING",
      _id: "",
      audience: "EMPLOYEE_TASK",
      source: "CUSTOM",
      category: "",
    } as Task,
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue(team);
    mockEventsForUser.mockReturnValue(events);
  });

  it("renders user labels and task slots per team member", () => {
    render(
      <UserCalendar
        events={events}
        date={new Date(2025, 0, 6, 12)}
        handleViewTask={handleViewTask}
        setCurrentDate={setCurrentDate}
      />
    );

    expect(screen.getByTestId("user-labels")).toBeInTheDocument();
    expect(userLabelsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ team })
    );

    const slots = screen.getAllByTestId("task-slot");
    expect(slots).toHaveLength(team.length);

    expect(taskSlotSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        handleViewTask,
        height: 300,
      })
    );
    expect(mockEventsForUser).toHaveBeenCalledTimes(team.length);
  });

  it("changes the current date when navigating", () => {
    render(
      <UserCalendar
        events={events}
        date={new Date(2025, 0, 6, 12)}
        handleViewTask={handleViewTask}
        setCurrentDate={setCurrentDate}
      />
    );

    fireEvent.click(screen.getByText("PrevDay"));
    fireEvent.click(screen.getByText("NextDay"));

    const prevFn = setCurrentDate.mock.calls[0][0];
    const nextFn = setCurrentDate.mock.calls[1][0];

    expect(prevFn(new Date(2025, 0, 6)).getDate()).toBe(5);
    expect(nextFn(new Date(2025, 0, 6)).getDate()).toBe(7);
  });
});
