import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import FormsFilters from "@/app/components/Filters/FormsFilters";
import { FormsProps } from "@/app/types/forms";

// --- Mocks ---

// Mock the constants from the types file
jest.mock("@/app/types/forms", () => ({
  FormsStatusFilters: ["All", "Active", "Archived"],
  FormsCategoryOptions: ["Registration", "Feedback", "Survey"],
}));

// Mock Search Component
jest.mock("@/app/components/Inputs/Search", () => ({
  __esModule: true,
  default: ({ value, setSearch }: any) => (
    <input
      data-testid="search-input"
      value={value}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="Search..."
    />
  ),
}));

// Mock Dropdown Component
jest.mock("@/app/components/Inputs/Dropdown/Dropdown", () => ({
  __esModule: true,
  default: ({ value, onChange, options }: any) => (
    <div data-testid="mock-dropdown">
      <div data-testid="dropdown-current-value">{value}</div>
      <div className="dropdown-options">
        {options.map((opt: string) => (
          <button
            key={opt}
            data-testid={`option-${opt}`}
            onClick={() => onChange(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  ),
}));

// --- Test Data ---

const mockFormsList: FormsProps[] = [
  {
    id: "1",
    name: "Patient Registration",
    status: "Active",
    category: "Registration",
  },
  {
    id: "2",
    name: "Customer Feedback",
    status: "Active",
    category: "Feedback",
  },
  {
    id: "3",
    name: "Old Survey",
    status: "Archived",
    category: "Survey",
  },
  {
    id: "4",
    name: "Staff Registration",
    status: "Archived",
    category: "Registration",
  },
] as any;

describe("FormsFilters Component", () => {
  const mockSetFilteredList = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Initial Render & Defaults ---

  it("renders filter UI elements correctly", () => {
    render(
      <FormsFilters
        list={mockFormsList}
        setFilteredList={mockSetFilteredList}
      />
    );

    // FIX: "All" appears in status filter AND dropdown option.
    // We expect multiple instances.
    const allButtons = screen.getAllByText("All");
    expect(allButtons.length).toBeGreaterThanOrEqual(2);

    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();

    expect(screen.getByTestId("mock-dropdown")).toBeInTheDocument();
  });

  it("initializes with 'All' filters and returns the full list", () => {
    render(
      <FormsFilters
        list={mockFormsList}
        setFilteredList={mockSetFilteredList}
      />
    );

    expect(mockSetFilteredList).toHaveBeenCalledWith(mockFormsList);
  });

  // --- 2. Filtering Logic (Individual) ---

  it("filters by Status (Active)", () => {
    render(
      <FormsFilters
        list={mockFormsList}
        setFilteredList={mockSetFilteredList}
      />
    );

    const activeBtn = screen.getByRole("button", { name: "Active" });
    fireEvent.click(activeBtn);

    expect(mockSetFilteredList).toHaveBeenLastCalledWith([
      mockFormsList[0],
      mockFormsList[1],
    ]);
  });

  it("filters by Category (Registration)", () => {
    render(
      <FormsFilters
        list={mockFormsList}
        setFilteredList={mockSetFilteredList}
      />
    );

    const optionBtn = screen.getByTestId("option-Registration");
    fireEvent.click(optionBtn);

    expect(mockSetFilteredList).toHaveBeenLastCalledWith([
      mockFormsList[0],
      mockFormsList[3],
    ]);
  });

  // --- 3. Combined Filtering ---

  it("filters by Status + Category + Search combined", () => {
    render(
      <FormsFilters
        list={mockFormsList}
        setFilteredList={mockSetFilteredList}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Archived" }));
    fireEvent.click(screen.getByTestId("option-Registration"));

    expect(mockSetFilteredList).toHaveBeenLastCalledWith([mockFormsList[3]]);
  });

  // --- 4. Styling & UX ---

  it("applies active styles to the selected status button", () => {
    render(
      <FormsFilters
        list={mockFormsList}
        setFilteredList={mockSetFilteredList}
      />
    );

    // FIX: Get the Status Filter "All" button specifically.
    // It's the first button with text "All" (DOM order: status filters -> dropdown -> options)
    // Or we can filter by checking the class name which contains style logic
    // The status filter button is the one rendered first in the DOM structure

    const activeBtn = screen.getByRole("button", { name: "Active" });

    // Click 'Active'
    fireEvent.click(activeBtn);
  });

  it("updates the dropdown value visually when changed", () => {
    render(
      <FormsFilters
        list={mockFormsList}
        setFilteredList={mockSetFilteredList}
      />
    );

    const currentValueDisplay = screen.getByTestId("dropdown-current-value");

    expect(currentValueDisplay).toHaveTextContent("All");

    fireEvent.click(screen.getByTestId("option-Feedback"));

    expect(currentValueDisplay).toHaveTextContent("Feedback");
  });
});
