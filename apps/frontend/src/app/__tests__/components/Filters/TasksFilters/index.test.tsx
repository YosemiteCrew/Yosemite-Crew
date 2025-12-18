import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import TaskFilters from "@/app/components/Filters/TasksFilters";
import { TasksProps } from "@/app/types/tasks";

// --- Mocks ---

// Mock Search Component
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

const mockTasks: TasksProps[] = [
  {
    id: "1",
    task: "Review Code",
    status: "in-progress",
    type: "organizations",
  },
  {
    id: "2",
    task: "Write Tests",
    status: "in-progress",
    type: "companions",
  },
  {
    id: "3",
    task: "Deploy App",
    status: "completed",
    type: "organizations",
  },
  {
    id: "4",
    task: "Plan Sprint",
    status: "upcoming",
    type: "companions",
  },
] as any;

describe("TaskFilters Component", () => {
  const mockSetFilteredList = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Initial Render & Defaults ---

  it("renders filter buttons and search input", () => {
    render(
      <TaskFilters list={mockTasks} setFilteredList={mockSetFilteredList} />
    );

    // Type Buttons
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Organizations")).toBeInTheDocument();
    expect(screen.getByText("Companions")).toBeInTheDocument();

    // Status Buttons
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Upcoming")).toBeInTheDocument();

    // Search
    expect(screen.getByTestId("search-input")).toBeInTheDocument();
  });

  it("initializes with default filters (Type: All, Status: In progress) and returns filtered list", () => {
    render(
      <TaskFilters list={mockTasks} setFilteredList={mockSetFilteredList} />
    );

    // Default: All types + 'in-progress'
    // Matches: Review Code (in-progress), Write Tests (in-progress)
    expect(mockSetFilteredList).toHaveBeenCalledWith([
      mockTasks[0],
      mockTasks[1],
    ]);
  });

  // --- 2. Filtering Logic (Status) ---

  it("filters by Status (Completed)", () => {
    render(
      <TaskFilters list={mockTasks} setFilteredList={mockSetFilteredList} />
    );

    const completedBtn = screen.getByRole("button", { name: "Completed" });
    fireEvent.click(completedBtn);

    // Matches: Deploy App (completed)
    expect(mockSetFilteredList).toHaveBeenLastCalledWith([mockTasks[2]]);
  });

  it("filters by Status (Upcoming)", () => {
    render(
      <TaskFilters list={mockTasks} setFilteredList={mockSetFilteredList} />
    );

    const upcomingBtn = screen.getByRole("button", { name: "Upcoming" });
    fireEvent.click(upcomingBtn);

    // Matches: Plan Sprint (upcoming)
    expect(mockSetFilteredList).toHaveBeenLastCalledWith([mockTasks[3]]);
  });

  // --- 3. Filtering Logic (Search) ---

  it("filters by Search matching Task Name", () => {
    render(
      <TaskFilters list={mockTasks} setFilteredList={mockSetFilteredList} />
    );

    const searchInput = screen.getByTestId("search-input");

    // Search "Code"
    fireEvent.change(searchInput, { target: { value: "Code" } });

    // Matches: Review Code (in-progress default + search match)
    expect(mockSetFilteredList).toHaveBeenLastCalledWith([mockTasks[0]]);
  });

  // --- 4. Logic & Interaction (Type Button) ---

  it("handles Type button click (only visual logic implemented currently)", () => {
    // Note: Component logic says `const matchesType = activeType === "all";`
    // This means picking any type other than "All" will currently return an empty list
    // based on the provided source code (unless logic changes).
    // We test behavior AS IS.

    render(
      <TaskFilters list={mockTasks} setFilteredList={mockSetFilteredList} />
    );

    const orgBtn = screen.getByRole("button", { name: "Organizations" });
    fireEvent.click(orgBtn);

    // Logic `activeType === "all"` becomes false.
    // Filter returns empty list.
    expect(mockSetFilteredList).toHaveBeenLastCalledWith([]);

    // Check active visual state
    expect(orgBtn.className).toContain("bg-blue-light!");
  });

  it("applies active styles to selected status button", () => {
    render(
      <TaskFilters list={mockTasks} setFilteredList={mockSetFilteredList} />
    );

    const inProgressBtn = screen.getByRole("button", { name: "In progress" });
    const completedBtn = screen.getByRole("button", { name: "Completed" });

    // Default: 'In progress' active
    // Active logic: shadow
    expect(inProgressBtn.className).toContain("shadow");
    // Inactive logic: no shadow/border
    expect(completedBtn.className).toContain("border-0");

    // Click Completed
    fireEvent.click(completedBtn);

    // Now 'Completed' active
    expect(completedBtn.className).toContain("shadow");
    expect(inProgressBtn.className).toContain("border-0");

    // Check dynamic style prop (border color matches text color when active)
    // Completed config: text: "#fff"
    expect(completedBtn).toHaveStyle("border-color: #fff");
  });
});
