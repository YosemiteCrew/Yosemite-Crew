import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
// FIX: Import the default export (ProtectedTasks) directly.
// The previous code might have imported { Tasks } or something else, but index.tsx exports default.
import ProtectedTasks from "@/app/pages/Tasks/index";
import { demoTasks } from "@/app/pages/Tasks/demo";

// --- Mocks ---

// Mock Data
jest.mock("@/app/pages/Tasks/demo", () => ({
  demoTasks: [
    { id: "t1", title: "Task 1", date: new Date("2023-01-01") },
    { id: "t2", title: "Task 2", date: new Date("2023-01-02") },
  ],
}));

// Mock Wrappers
jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: any) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

jest.mock("@/app/components/OrgGuard", () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="org-guard">{children}</div>,
}));

// Mock Child Components
jest.mock("@/app/components/TitleCalendar", () => ({
  __esModule: true,
  default: ({
    setAddPopup,
    setActiveCalendar,
    setCurrentDate,
    activeCalendar,
    currentDate,
  }: any) => (
    <div data-testid="title-calendar">
      <span data-testid="current-mode">{activeCalendar}</span>
      <span data-testid="current-date">{currentDate.toISOString()}</span>
      <button onClick={() => setAddPopup(true)}>Open Add</button>
      <button onClick={() => setActiveCalendar("month")}>Set Month View</button>
      <button onClick={() => setCurrentDate(new Date("2023-12-25"))}>
        Jump Date
      </button>
    </div>
  ),
}));

jest.mock("@/app/components/Filters/TasksFilters", () => ({
  __esModule: true,
  default: ({ setFilteredList }: any) => (
    <div data-testid="task-filters">
      <button onClick={() => setFilteredList([])}>Clear Filters</button>
      <button onClick={() => setFilteredList(demoTasks)}>Reset Filters</button>
    </div>
  ),
}));

jest.mock("@/app/components/Calendar/TaskCalendar", () => ({
  __esModule: true,
  default: ({ weekStart, setViewPopup, setActiveTask }: any) => (
    <div data-testid="task-calendar">
      <span data-testid="week-start">{weekStart.toISOString()}</span>
      <button
        onClick={() => {
          setActiveTask(demoTasks[1]); // Select Task 2
          setViewPopup(true);
        }}
      >
        Select Task Cal
      </button>
    </div>
  ),
}));

jest.mock("@/app/components/DataTable/Tasks", () => ({
  __esModule: true,
  default: ({ filteredList, setViewPopup, setActiveTask }: any) => (
    <div data-testid="tasks-table">
      <span>List Count: {filteredList.length}</span>
      <button
        onClick={() => {
          setActiveTask(demoTasks[0]); // Select Task 1
          setViewPopup(true);
        }}
      >
        Select Task Table
      </button>
    </div>
  ),
}));

jest.mock("@/app/pages/Tasks/Sections/AddTask", () => ({
  __esModule: true,
  default: ({ showModal }: any) =>
    showModal ? <div data-testid="add-task-modal">Add Modal</div> : null,
}));

jest.mock("@/app/pages/Tasks/Sections/TaskInfo", () => ({
  __esModule: true,
  default: ({ showModal, activeTask }: any) =>
    showModal && activeTask ? (
      <div data-testid="task-info-modal">Info: {activeTask.title}</div>
    ) : null,
}));

describe("Tasks Page Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Structure & Rendering ---

  it("renders the main layout with all sub-components", () => {
    render(<ProtectedTasks />);

    // Check that wrappers are present
    expect(screen.getByTestId("protected-route")).toBeInTheDocument();
    expect(screen.getByTestId("org-guard")).toBeInTheDocument();

    // Check inner content
    expect(screen.getByTestId("title-calendar")).toBeInTheDocument();
    expect(screen.getByTestId("task-filters")).toBeInTheDocument();
    expect(screen.getByTestId("task-calendar")).toBeInTheDocument();
    expect(screen.getByTestId("tasks-table")).toBeInTheDocument();
  });

  it("initializes with data and selects the first task as active", () => {
    render(<ProtectedTasks />);
    expect(screen.getByText("List Count: 2")).toBeInTheDocument();
  });

  // --- 2. State Interactions: Modals ---

  it("opens Add Task modal when triggered from TitleCalendar", () => {
    render(<ProtectedTasks />);
    expect(screen.queryByTestId("add-task-modal")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Open Add"));
    expect(screen.getByTestId("add-task-modal")).toBeInTheDocument();
  });

  it("opens Task Info modal when a task is selected from Table", () => {
    render(<ProtectedTasks />);
    expect(screen.queryByTestId("task-info-modal")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Select Task Table"));
    expect(screen.getByTestId("task-info-modal")).toHaveTextContent(
      "Info: Task 1"
    );
  });

  it("opens Task Info modal when a task is selected from Calendar", () => {
    render(<ProtectedTasks />);
    fireEvent.click(screen.getByText("Select Task Cal"));
    expect(screen.getByTestId("task-info-modal")).toHaveTextContent(
      "Info: Task 2"
    );
  });

  // --- 3. State Interactions: Calendar & Date Logic ---

  it("updates active calendar view mode", () => {
    render(<ProtectedTasks />);
    expect(screen.getByTestId("current-mode")).toHaveTextContent("week");

    fireEvent.click(screen.getByText("Set Month View"));
    expect(screen.getByTestId("current-mode")).toHaveTextContent("month");
  });

  it("updates current date and recalculates weekStart", () => {
    render(<ProtectedTasks />);

    const initialWeekStart = screen.getByTestId("week-start").textContent;

    fireEvent.click(screen.getByText("Jump Date"));

    const newDate = new Date("2023-12-25");
    expect(screen.getByTestId("current-date")).toHaveTextContent(
      newDate.toISOString()
    );

    const newWeekStart = screen.getByTestId("week-start").textContent;
    expect(newWeekStart).not.toBe(initialWeekStart);
  });

  // --- 4. State Interactions: Filtering ---

  it("synchronizes activeTask when filtered list becomes empty", () => {
    render(<ProtectedTasks />);

    fireEvent.click(screen.getByText("Clear Filters"));
    expect(screen.getByText("List Count: 0")).toBeInTheDocument();
  });

  it("resets activeTask to first item when list repopulates", () => {
    render(<ProtectedTasks />);

    fireEvent.click(screen.getByText("Clear Filters"));
    fireEvent.click(screen.getByText("Reset Filters"));

    expect(screen.getByText("List Count: 2")).toBeInTheDocument();
  });
});
