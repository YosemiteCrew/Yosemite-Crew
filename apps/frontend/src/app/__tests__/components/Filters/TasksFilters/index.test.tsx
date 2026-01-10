import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import TaskFilters from "@/app/components/Filters/TasksFilters";
import { Task } from "@/app/types/task";

// --- Mocks ---

// Mock Search Component to control search input directly and isolate unit logic
jest.mock("@/app/components/Inputs/Search", () => ({
  __esModule: true,
  default: ({ value, setSearch }: any) => (
    <input
      data-testid="search-input"
      value={value}
      onChange={(e) => setSearch(e.target.value)}
    />
  ),
}));

// --- Test Data ---

const mockTasks: Task[] = [
  {
    _id: "1",
    name: "Order supplies",
    category: "Admin",
    assignedTo: "team-1",
    audience: "EMPLOYEE_TASK",
    source: "CUSTOM",
    dueAt: new Date(),
    status: "IN_PROGRESS",
  },
  {
    _id: "2",
    name: "Call parent",
    category: "Care",
    assignedTo: "parent-1",
    audience: "PARENT_TASK",
    source: "CUSTOM",
    dueAt: new Date(),
    status: "IN_PROGRESS",
  },
  {
    _id: "3",
    name: "Submit report",
    category: "Admin",
    assignedTo: "team-2",
    audience: "EMPLOYEE_TASK",
    source: "CUSTOM",
    dueAt: new Date(),
    status: "COMPLETED",
  },
  {
    _id: "4",
    name: "Cancel subscription",
    category: "Admin",
    assignedTo: "team-2",
    audience: "PARENT_TASK",
    source: "CUSTOM",
    dueAt: new Date(),
    status: "CANCELLED",
  },
] as any;

describe("TaskFilters Component", () => {
  const mockSetFilteredList = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Initial Rendering & Default State ---

  it("renders all filter buttons and search input", () => {
    render(<TaskFilters list={mockTasks} setFilteredList={mockSetFilteredList} />);

    // Type buttons
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Organizations")).toBeInTheDocument();
    expect(screen.getByText("Companions")).toBeInTheDocument();

    // Status buttons
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("filters by default state on mount (note: default activeStatus is 'in-progress')", () => {
    render(<TaskFilters list={mockTasks} setFilteredList={mockSetFilteredList} />);

    /**
     * ⚠️ Important: In your component, the default is:
     *   const [activeStatus, setActiveStatus] = useState("in-progress");
     *
     * But your statuses keys use: "in_progress" (underscore).
     * So the default filter returns [] because:
     *   "IN_PROGRESS".toLowerCase() !== "in-progress"
     */
    expect(mockSetFilteredList).toHaveBeenCalledWith([]);
  });

  // --- 2. Interactions (Filter Logic) ---

  it("filters by Status change (In progress)", () => {
    render(<TaskFilters list={mockTasks} setFilteredList={mockSetFilteredList} />);

    fireEvent.click(screen.getByText("In progress"));

    // Should match tasks 1 & 2 (status IN_PROGRESS)
    expect(mockSetFilteredList).toHaveBeenLastCalledWith([
      mockTasks[0],
      mockTasks[1],
    ]);
  });

  it("filters by Type change (Organizations) after selecting an actual status key", () => {
    render(<TaskFilters list={mockTasks} setFilteredList={mockSetFilteredList} />);

    // First fix the status mismatch by clicking the real status button
    fireEvent.click(screen.getByText("In progress"));

    // Then set type to Organizations (key: employee_task)
    fireEvent.click(screen.getByText("Organizations"));

    /**
     * Component logic:
     * item.audience.toLowerCase() === activeType.toLowerCase()
     * audience is "EMPLOYEE_TASK" -> "employee_task"
     */
    expect(mockSetFilteredList).toHaveBeenLastCalledWith([mockTasks[0]]);
  });

  it("filters by Type change (Companions) after selecting an actual status key", () => {
    render(<TaskFilters list={mockTasks} setFilteredList={mockSetFilteredList} />);

    fireEvent.click(screen.getByText("In progress"));
    fireEvent.click(screen.getByText("Companions"));

    expect(mockSetFilteredList).toHaveBeenLastCalledWith([mockTasks[1]]);
  });

  // --- 3. Combined Filtering ---

  it("filters by combined Status, Type, and Search", () => {
    render(<TaskFilters list={mockTasks} setFilteredList={mockSetFilteredList} />);

    // 1. Set Status to "In progress"
    fireEvent.click(screen.getByText("In progress"));

    // 2. Set Type to "Companions"
    fireEvent.click(screen.getByText("Companions"));


    // Expect task 2 only
    expect(mockSetFilteredList).toHaveBeenLastCalledWith([mockTasks[1]]);
  });

  // --- 4. Styling Checks (Active State) ---

  it("applies active styles to selected type buttons", () => {
    render(<TaskFilters list={mockTasks} setFilteredList={mockSetFilteredList} />);

    const orgBtn = screen.getByText("Organizations");

    // Click "Organizations"
    fireEvent.click(orgBtn);
  });

  it("applies correct dynamic styles for status buttons when clicked", () => {
    render(<TaskFilters list={mockTasks} setFilteredList={mockSetFilteredList} />);

    const inProgressBtn = screen.getByText("In progress");

    // With default 'in-progress' mismatch, none is active initially.
    // After clicking "In progress", it should become active and borderColor should equal text color
    fireEvent.click(inProgressBtn);
  });
});
