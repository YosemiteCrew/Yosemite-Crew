import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Tasks from "@/app/pages/Tasks";
import { Task } from "@/app/types/task";

jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/components/OrgGuard", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

const useTasksMock = jest.fn();

jest.mock("@/app/hooks/useTask", () => ({
  useTasksForPrimaryOrg: () => useTasksMock(),
}));

jest.mock("@/app/stores/searchStore", () => ({
  useSearchStore: (selector: any) => selector({ query: "" }),
}));

const titleCalendarSpy = jest.fn();

jest.mock("@/app/components/TitleCalendar", () => ({
  __esModule: true,
  default: (props: any) => {
    titleCalendarSpy(props);
    return (
      <button type="button" onClick={() => props.setActiveView("table")}
        >
        SwitchView
      </button>
    );
  },
}));

jest.mock("@/app/components/Filters/Filters", () => ({
  __esModule: true,
  default: () => <div data-testid="filters" />,
}));

const taskCalendarSpy = jest.fn();

jest.mock("@/app/components/Calendar/TaskCalendar", () => ({
  __esModule: true,
  default: (props: any) => {
    taskCalendarSpy(props);
    return <div data-testid="calendar" />;
  },
}));

jest.mock("@/app/components/DataTable/Tasks", () => ({
  __esModule: true,
  default: () => <div data-testid="table" />,
}));

jest.mock("@/app/pages/Tasks/Sections/AddTask", () => ({
  __esModule: true,
  default: () => <div data-testid="add-task" />,
}));

jest.mock("@/app/pages/Tasks/Sections/TaskInfo", () => ({
  __esModule: true,
  default: () => <div data-testid="task-info" />,
}));

describe("Tasks page", () => {
  const tasks: Task[] = [
    {
      _id: "task-1",
      name: "Follow up",
      status: "PENDING",
      audience: "EMPLOYEE_TASK",
    } as Task,
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    useTasksMock.mockReturnValue(tasks);
  });

  it("renders calendar view by default and switches to table", () => {
    render(<Tasks />);

    expect(screen.getByTestId("calendar")).toBeInTheDocument();
    expect(taskCalendarSpy).toHaveBeenCalledWith(
      expect.objectContaining({ filteredList: tasks })
    );

    fireEvent.click(screen.getByText("SwitchView"));
    expect(screen.getByTestId("table")).toBeInTheDocument();
  });
});
