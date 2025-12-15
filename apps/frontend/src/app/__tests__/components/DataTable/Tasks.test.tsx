import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import Tasks, { getStatusStyle } from "@/app/components/DataTable/Tasks";
import { TasksProps } from "@/app/types/tasks";

// --- Mocks ---

// Mock GenericTable to test that columns and data are passed correctly
// and to render the cell contents (which contain the logic we want to test)
jest.mock("@/app/components/GenericTable/GenericTable", () => {
  return ({ data, columns }: any) => (
    <div data-testid="generic-table">
      <div data-testid="table-headers">
        {columns.map((col: any) => (
          <span key={col.key}>{col.label}</span>
        ))}
      </div>
      <div data-testid="table-body">
        {data.map((item: any, i: number) => (
          <div key={i+"tasks-key"} data-testid={`row-${i}`}>
            {columns.map((col: any) => (
              <div key={col.key} data-testid={`cell-${col.key}`}>
                {col.render ? col.render(item) : item[col.key]}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
});

// Mock TaskCard for mobile view
// Use button for accessibility (onClick on div is bad practice/lint error)
jest.mock("@/app/components/Cards/TaskCard", () => {
  return ({ item, handleViewTask }: any) => (
    <button
      data-testid={`task-card-${item.task}`}
      onClick={() => handleViewTask(item)}
    >
      {item.task}
    </button>
  );
});

// Mock Icons
jest.mock("react-icons/io5", () => ({
  IoEye: () => <span data-testid="eye-icon">Eye</span>,
}));

// Mock Helper - Use absolute path to avoid relative path confusion in tests
jest.mock("@/app/components/Calendar/weekHelpers", () => ({
  getFormattedDate: jest.fn(() => "Jan 01"),
}));

// --- Test Data ---

const mockTasks: TasksProps[] = [
  {
    task: "Surgery Prep",
    description: "Prepare room 1",
    category: "Medical",
    from: "Dr. Smith",
    to: "Nurse Joy",
    toLabel: "Nurse",
    due: new Date("2023-01-01"),
    status: "In-progress",
  },
  {
    task: "Inventory Check",
    description: "Count meds",
    category: "Admin",
    from: "Manager",
    to: "Staff",
    toLabel: "Admin",
    due: new Date("2023-01-02"),
    status: "Completed",
  },
];

describe("Tasks Component", () => {
  const mockSetActiveTask = jest.fn();
  const mockSetViewPopup = jest.fn();

  const defaultProps = {
    filteredList: mockTasks,
    setActiveTask: mockSetActiveTask,
    setViewPopup: mockSetViewPopup,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Helper Function Tests ---

  describe("getStatusStyle", () => {
    it("returns correct style for 'In-progress'", () => {
      const style = getStatusStyle("In-progress");
      expect(style).toEqual({ color: "#54B492", backgroundColor: "#E6F4EF" });
    });

    it("returns correct style for 'Completed'", () => {
      const style = getStatusStyle("Completed");
      expect(style).toEqual({ color: "#fff", backgroundColor: "#008F5D" });
    });

    it("returns default style for other statuses", () => {
      const style = getStatusStyle("Pending");
      expect(style).toEqual({ color: "#fff", backgroundColor: "#247AED" });
    });

    it("handles mixed case input", () => {
      const style = getStatusStyle("in-PROGRESS");
      expect(style).toEqual({ color: "#54B492", backgroundColor: "#E6F4EF" });
    });
  });

  // --- 2. Desktop View (Table) Tests ---

  it("renders table with all columns and data by default", () => {
    render(<Tasks {...defaultProps} />);

    // Headers
    expect(screen.getByText("Task")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Category")).toBeInTheDocument();
    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getByText("To")).toBeInTheDocument();
    expect(screen.getByText("Due date")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();

    // Data Row 1 content
    // FIX: Use getAllByText because text appears in both Table (Desktop) and Card (Mobile/Hidden)
    expect(screen.getAllByText("Surgery Prep").length).toBeGreaterThan(0);
    expect(screen.getByText("Prepare room 1")).toBeInTheDocument();
    expect(screen.getByText("Medical")).toBeInTheDocument();
    expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
    expect(screen.getByText("Nurse Joy")).toBeInTheDocument();
    expect(screen.getByText("Nurse")).toBeInTheDocument(); // toLabel
    expect(screen.getAllByText("Jan 01").length).toBeGreaterThan(0); // Date mock
    expect(screen.getByText("In-progress")).toBeInTheDocument();
  });

  it("triggers view handlers when action button is clicked", () => {
    render(<Tasks {...defaultProps} />);

    // Find the button wrapping the eye icon
    const viewButton = screen.getAllByTestId("eye-icon")[0].closest("button");
    fireEvent.click(viewButton!);

    expect(mockSetActiveTask).toHaveBeenCalledWith(mockTasks[0]);
    expect(mockSetViewPopup).toHaveBeenCalledWith(true);
  });

  it("hides the 'Actions' column when hideActions is true", () => {
    render(<Tasks {...defaultProps} hideActions={true} />);

    // "Actions" header should not be present
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();

    // Action buttons/icons should not be present in rows
    expect(screen.queryByTestId("eye-icon")).not.toBeInTheDocument();
  });

  it("renders status with correct style via getStatusStyle in table", () => {
    render(<Tasks {...defaultProps} />);
    const statusDiv = screen.getByText("In-progress");
    expect(statusDiv).toHaveStyle("color: #54B492");
    expect(statusDiv).toHaveStyle("background-color: #E6F4EF");
  });

  // --- 3. Mobile View (Cards) Tests ---

  it("renders cards in mobile view (hidden on desktop via css)", () => {
    render(<Tasks {...defaultProps} />);

    expect(screen.getByTestId("task-card-Surgery Prep")).toBeInTheDocument();
    expect(screen.getByTestId("task-card-Inventory Check")).toBeInTheDocument();
  });

  it("triggers view handlers when a mobile card is clicked", () => {
    render(<Tasks {...defaultProps} />);

    const card = screen.getByTestId("task-card-Surgery Prep");
    fireEvent.click(card);

    expect(mockSetActiveTask).toHaveBeenCalledWith(mockTasks[0]);
    expect(mockSetViewPopup).toHaveBeenCalledWith(true);
  });

  // --- 4. Edge Cases ---

  it("does not crash if event handlers are undefined", () => {
    // Render without passing handlers
    render(<Tasks filteredList={mockTasks} />);

    const viewButton = screen.getAllByTestId("eye-icon")[0].closest("button");
    fireEvent.click(viewButton!);

    // Should assume no error thrown
    // We check that our mocks weren't called just to be safe they aren't leaking
    expect(mockSetActiveTask).not.toHaveBeenCalled();
  });
});
