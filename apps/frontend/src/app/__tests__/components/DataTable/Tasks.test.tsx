import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import Tasks, { getStatusStyle } from "@/app/components/DataTable/Tasks";
import { Task } from "@/app/types/task";

jest.mock("@/app/components/GenericTable/GenericTable", () => ({
  __esModule: true,
  default: ({ data, columns }: any) => (
    <div data-testid="generic-table">
      {data.map((item: any, index: number) => (
        <div key={index} data-testid="row">
          {columns.map((col: any) => (
            <div key={col.key} data-testid={`cell-${col.key}`}>
              {col.render ? col.render(item) : item[col.key]}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

jest.mock("@/app/components/Cards/TaskCard", () => ({
  __esModule: true,
  default: ({ item }: any) => <div data-testid="task-card">{item.name}</div>,
}));

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: jest.fn(),
}));

jest.mock("react-icons/io5", () => ({
  IoEye: () => <span data-testid="eye-icon" />,
}));

jest.mock("@/app/components/Calendar/weekHelpers", () => ({
  getFormattedDate: () => "Jan 1",
}));

import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";

describe("Tasks table", () => {
  const task: Task = {
    name: "Task A",
    description: "Desc",
    category: "Cat",
    assignedBy: "team-1",
    assignedTo: "team-2",
    dueAt: new Date("2025-01-01T10:00:00Z"),
    status: "PENDING",
  } as Task;

  beforeEach(() => {
    jest.clearAllMocks();
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: "team-1", name: "Alex" },
      { _id: "team-2", name: "Sam" },
    ]);
  });

  it("renders actions and handles view click", () => {
    const setActiveTask = jest.fn();
    const setViewPopup = jest.fn();

    render(
      <Tasks
        filteredList={[task]}
        setActiveTask={setActiveTask}
        setViewPopup={setViewPopup}
      />
    );

    fireEvent.click(screen.getByTestId("eye-icon").closest("button")!);
    expect(setActiveTask).toHaveBeenCalledWith(task);
    expect(setViewPopup).toHaveBeenCalledWith(true);
  });

  it("hides actions when hideActions is true", () => {
    render(<Tasks filteredList={[task]} hideActions={true} />);
    expect(screen.queryByTestId("eye-icon")).not.toBeInTheDocument();
  });

  it("returns styles for pending status", () => {
    expect(getStatusStyle("pending")).toEqual({
      color: "#fff",
      backgroundColor: "#747283",
    });
  });
});
