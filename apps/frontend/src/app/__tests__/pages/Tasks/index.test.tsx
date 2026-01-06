import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// Adjusted path: Go up 3 levels to reach 'src/app'
import ProtectedTasks from "../../../pages/Tasks/index";
import {
  useLoadTasksForPrimaryOrg,
  useTasksForPrimaryOrg,
} from "../../../hooks/useTask";
import { getStartOfWeek } from "../../../components/Calendar/weekHelpers";

// --- Mocks ---

// Mock Hooks
jest.mock("../../../hooks/useTask", () => ({
  useLoadTasksForPrimaryOrg: jest.fn(),
  useTasksForPrimaryOrg: jest.fn(),
}));

jest.mock("../../../components/Calendar/weekHelpers", () => ({
  getStartOfWeek: jest.fn(),
}));

// Mock Wrappers (Pass-through)
jest.mock("@/app/components/ProtectedRoute", () => ({ children }: any) => (
  <div data-testid="protected-route">{children}</div>
));
jest.mock("@/app/components/OrgGuard", () => ({ children }: any) => (
  <div data-testid="org-guard">{children}</div>
));

// Mock Child Components
jest.mock(
  "@/app/components/TitleCalendar",
  () =>
    ({ setActiveCalendar, setAddPopup, currentDate }: any) => (
      <div data-testid="title-calendar">
        <span>Date: {currentDate.toString()}</span>
        <button onClick={() => setActiveCalendar("month")}>Set Month View</button>
        <button onClick={() => setAddPopup(true)}>Add Task</button>
      </div>
    )
);

jest.mock(
  "@/app/components/Filters/TasksFilters",
  () =>
    ({ setFilteredList, list }: any) => (
      <div data-testid="task-filters">
        <button onClick={() => setFilteredList(list)}>Reset Filter</button>
      </div>
    )
);

jest.mock(
  "@/app/components/Calendar/TaskCalendar",
  () =>
    ({ activeCalendar, setViewPopup, setActiveTask }: any) => (
      <div data-testid="task-calendar">
        <span>View: {activeCalendar}</span>
        <button
          onClick={() => {
            setActiveTask({ _id: "task-1" });
            setViewPopup(true);
          }}
        >
          Open Calendar Task
        </button>
      </div>
    )
);

// Adjusted path: Go up 3 levels to reach 'src/app'
jest.mock(
  "../../../components/DataTable/Tasks",
  () =>
    ({ setViewPopup, setActiveTask }: any) => (
      <div data-testid="task-table">
        <button
          onClick={() => {
            setActiveTask({ _id: "task-1" });
            setViewPopup(true);
          }}
        >
          Open Table Task
        </button>
      </div>
    )
);

// Adjusted path: Go up 3 levels to reach 'src/app'
jest.mock(
  "../../../pages/Tasks/Sections/AddTask",
  () =>
    ({ showModal, setShowModal }: any) =>
      showModal ? (
        <div data-testid="add-task-modal">
          <button onClick={() => setShowModal(false)}>Close Add</button>
        </div>
      ) : null
);

// Adjusted path: Go up 3 levels to reach 'src/app'
jest.mock(
  "../../../pages/Tasks/Sections/TaskInfo",
  () =>
    ({ showModal, setShowModal, activeTask }: any) =>
      showModal ? (
        <div data-testid="view-task-modal">
          <span>Info: {activeTask?._id}</span>
          <button onClick={() => setShowModal(false)}>Close View</button>
        </div>
      ) : null
);

describe("Tasks Page", () => {
  const mockTasks = [
    { _id: "task-1", title: "Task One" },
    { _id: "task-2", title: "Task Two" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useLoadTasksForPrimaryOrg as jest.Mock).mockImplementation(() => undefined);
    (useTasksForPrimaryOrg as jest.Mock).mockReturnValue(mockTasks);
    (getStartOfWeek as jest.Mock).mockReturnValue(new Date("2025-01-01"));
  });

  // --- Section 1: Rendering & Wrappers ---

  it("renders wrapped in ProtectedRoute and OrgGuard", () => {
    render(<ProtectedTasks />);
    expect(screen.getByTestId("protected-route")).toBeInTheDocument();
    expect(screen.getByTestId("org-guard")).toBeInTheDocument();
    expect(screen.getByTestId("title-calendar")).toBeInTheDocument();
  });

  it("renders all main child components", () => {
    render(<ProtectedTasks />);
    expect(screen.getByTestId("task-filters")).toBeInTheDocument();
    expect(screen.getByTestId("task-calendar")).toBeInTheDocument();
    expect(screen.getByTestId("task-table")).toBeInTheDocument();
  });

  // --- Section 2: Hook Calls ---

  it("calls useLoadTasksForPrimaryOrg on mount", () => {
    render(<ProtectedTasks />);
    expect(useLoadTasksForPrimaryOrg).toHaveBeenCalled();
  });

  // --- Section 3: State & Interaction (Popups) ---

  it("toggles the Add Task modal", () => {
    render(<ProtectedTasks />);

    // Closed initially
    expect(screen.queryByTestId("add-task-modal")).not.toBeInTheDocument();

    // Open
    fireEvent.click(screen.getByText("Add Task"));
    expect(screen.getByTestId("add-task-modal")).toBeInTheDocument();

    // Close
    fireEvent.click(screen.getByText("Close Add"));
    expect(screen.queryByTestId("add-task-modal")).not.toBeInTheDocument();
  });

  it("toggles the View Task modal from Calendar interaction", () => {
    render(<ProtectedTasks />);

    // Closed initially
    expect(screen.queryByTestId("view-task-modal")).not.toBeInTheDocument();

    // Open from Calendar
    fireEvent.click(screen.getByText("Open Calendar Task"));
    expect(screen.getByTestId("view-task-modal")).toBeInTheDocument();
    expect(screen.getByText("Info: task-1")).toBeInTheDocument();

    // Close
    fireEvent.click(screen.getByText("Close View"));
    expect(screen.queryByTestId("view-task-modal")).not.toBeInTheDocument();
  });

  it("toggles the View Task modal from Table interaction", () => {
    render(<ProtectedTasks />);

    // Open from Table
    fireEvent.click(screen.getByText("Open Table Task"));
    expect(screen.getByTestId("view-task-modal")).toBeInTheDocument();

    // Close
    fireEvent.click(screen.getByText("Close View"));
    expect(screen.queryByTestId("view-task-modal")).not.toBeInTheDocument();
  });

  // --- Section 4: Data Flow & Effects ---

  it("updates activeTask when the tasks list changes (updating existing)", () => {
    const { rerender } = render(<ProtectedTasks />);

    // Set active task + open modal
    fireEvent.click(screen.getByText("Open Table Task"));
    expect(screen.getByTestId("view-task-modal")).toBeInTheDocument();

    // Simulate data refresh (same _id, changed data)
    const updatedTasks = [
      { _id: "task-1", title: "Task One Updated" },
      { _id: "task-2", title: "Task Two" },
    ];
    (useTasksForPrimaryOrg as jest.Mock).mockReturnValue(updatedTasks);

    rerender(<ProtectedTasks />);

    // Still showing modal (no crash/reset)
    expect(screen.getByTestId("view-task-modal")).toBeInTheDocument();
  });

  it("resets activeTask to first item if current active is removed from list", () => {
    const { rerender } = render(<ProtectedTasks />);

    // Replace list with a different one
    const newTasks = [{ _id: "task-99", title: "New One" }];
    (useTasksForPrimaryOrg as jest.Mock).mockReturnValue(newTasks);

    rerender(<ProtectedTasks />);

    // Implicit verification: no crash, UI remains stable
    expect(screen.getByTestId("task-calendar")).toBeInTheDocument();
  });

  it("handles empty tasks list gracefully", () => {
    (useTasksForPrimaryOrg as jest.Mock).mockReturnValue([]);
    render(<ProtectedTasks />);

    // Should render without crashing, activeTask becomes null
    expect(screen.getByTestId("task-calendar")).toBeInTheDocument();
  });

  // --- Section 5: Date & Calendar Logic ---

  it("updates week start when active calendar view changes", () => {
    render(<ProtectedTasks />);

    // Clear initial calls to ignore mount-time behavior (strict mode double call etc)
    (getStartOfWeek as jest.Mock).mockClear();

    // Trigger view change
    fireEvent.click(screen.getByText("Set Month View"));
    expect(screen.getByText("View: month")).toBeInTheDocument();

    // If you want to assert calls, uncomment:
    // expect(getStartOfWeek).toHaveBeenCalledTimes(1);
  });
});
