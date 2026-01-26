import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import ProtectedTasks from "@/app/pages/Tasks";

const useTasksMock = jest.fn();
const usePermissionsMock = jest.fn();
const useSearchStoreMock = jest.fn();
const taskCalendarSpy = jest.fn();
const taskTableSpy = jest.fn();

jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/components/OrgGuard", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/hooks/useTask", () => ({
  useTasksForPrimaryOrg: () => useTasksMock(),
}));

jest.mock("@/app/hooks/usePermissions", () => ({
  usePermissions: () => usePermissionsMock(),
}));

jest.mock("@/app/stores/searchStore", () => ({
  useSearchStore: (selector: any) => useSearchStoreMock(selector),
}));

jest.mock("@/app/components/PermissionGate", () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/components/TitleCalendar", () => (props: any) => (
  <div>
    <button type="button" onClick={() => props.setActiveView("calendar")}
    >
      Calendar
    </button>
    <button type="button" onClick={() => props.setActiveView("list")}
    >
      List
    </button>
  </div>
));

jest.mock("@/app/components/Filters/Filters", () => () => (
  <div data-testid="filters" />
));

jest.mock("@/app/components/Calendar/TaskCalendar", () => (props: any) => {
  taskCalendarSpy(props);
  return <div data-testid="task-calendar" />;
});

jest.mock("@/app/components/DataTable/Tasks", () => (props: any) => {
  taskTableSpy(props);
  return <div data-testid="tasks-table" />;
});

jest.mock("@/app/pages/Tasks/Sections/AddTask", () => () => (
  <div data-testid="add-task" />
));

jest.mock("@/app/pages/Tasks/Sections/TaskInfo", () => () => (
  <div data-testid="task-info" />
));

describe("Tasks page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTasksMock.mockReturnValue([
      { _id: "t1", status: "pending", audience: "EMPLOYEE_TASK", name: "Follow up" },
      { _id: "t2", status: "completed", audience: "EMPLOYEE_TASK", name: "Close" },
    ]);
    usePermissionsMock.mockReturnValue({ can: jest.fn(() => true) });
    useSearchStoreMock.mockImplementation((selector: any) =>
      selector({ query: "follow" })
    );
  });

  it("renders calendar view and switches to table", () => {
    render(<ProtectedTasks />);

    expect(screen.getByTestId("task-calendar")).toBeInTheDocument();
    expect(taskCalendarSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        filteredList: [expect.objectContaining({ _id: "t1" })],
      })
    );

    fireEvent.click(screen.getByText("List"));
    expect(screen.getByTestId("tasks-table")).toBeInTheDocument();
    expect(taskTableSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        filteredList: [expect.objectContaining({ _id: "t1" })],
      })
    );
  });
});
