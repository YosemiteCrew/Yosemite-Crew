import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import TasksPage from "@/app/pages/Tasks";

const useTasksMock = jest.fn();
const useLoadTasksMock = jest.fn();

jest.mock("@/app/hooks/useTask", () => ({
  useTasksForPrimaryOrg: () => useTasksMock(),
  useLoadTasksForPrimaryOrg: () => useLoadTasksMock(),
}));

jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="protected">{children}</div>,
}));

jest.mock("@/app/components/OrgGuard", () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="org-guard">{children}</div>,
}));

jest.mock("@/app/components/TitleCalendar", () => ({
  __esModule: true,
  default: ({ setActiveView }: any) => (
    <button type="button" onClick={() => setActiveView("list")}>
      switch-list
    </button>
  ),
}));

jest.mock("@/app/components/Filters/TasksFilters", () => ({
  __esModule: true,
  default: () => <div>filters</div>,
}));

jest.mock("@/app/components/DataTable/Tasks", () => ({
  __esModule: true,
  default: () => <div>tasks-table</div>,
}));

jest.mock("@/app/components/Calendar/TaskCalendar", () => ({
  __esModule: true,
  default: () => <div>calendar</div>,
}));

jest.mock("@/app/pages/Tasks/Sections/AddTask", () => ({
  __esModule: true,
  default: () => <div>add-task</div>,
}));

jest.mock("@/app/pages/Tasks/Sections/TaskInfo", () => ({
  __esModule: true,
  default: () => <div>task-info</div>,
}));

describe("Tasks page", () => {
  it("renders list view when toggled", () => {
    useTasksMock.mockReturnValue([{ _id: "1", name: "Task" }]);

    render(<TasksPage />);

    expect(screen.getByTestId("protected")).toBeInTheDocument();
    expect(screen.getByText("calendar")).toBeInTheDocument();

    fireEvent.click(screen.getByText("switch-list"));
    expect(screen.getByText("tasks-table")).toBeInTheDocument();
  });
});
