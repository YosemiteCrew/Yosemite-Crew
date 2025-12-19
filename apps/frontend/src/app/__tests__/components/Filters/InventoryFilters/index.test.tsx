import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import InventoryFilters from "@/app/components/Filters/InventoryFilters";
import { InventoryFiltersState } from "@/app/pages/Inventory/types";

// --- Mocks ---

// Mock Search Component
jest.mock("@/app/components/Inputs/Search", () => ({
  __esModule: true,
  default: ({ value, setSearch, className }: any) => (
    <input
      data-testid="search-input"
      className={className}
      value={value}
      onChange={(e) => setSearch(e.target.value)}
    />
  ),
}));

// Mock Dropdown Component
// We simulate options as buttons to easily test the mapping logic and click handlers
jest.mock("@/app/components/Inputs/Dropdown/Dropdown", () => ({
  __esModule: true,
  default: ({ value, onChange, options, disabled }: any) => (
    <div data-testid="dropdown-mock">
      <div data-testid="dropdown-value">{value}</div>
      <div data-testid="dropdown-disabled">{disabled ? "true" : "false"}</div>
      {options.map((opt: any) => (
        <button
          key={opt.value}
          data-testid={`option-${opt.value}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  ),
}));

// --- Test Data ---

const defaultFilters: InventoryFiltersState = {
  search: "",
  category: "all",
  status: "ALL",
  // Add other properties required by InventoryFiltersState if any,
  // otherwise just these three are used in the component
} as any;

const mockCategories = ["Medical", "Retail", "Food"];

describe("InventoryFilters Component", () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering & Default State ---

  it("renders correctly with default props", () => {
    render(
      <InventoryFilters
        filters={defaultFilters}
        onChange={mockOnChange}
        categories={mockCategories}
      />
    );

    // Check Search is present
    expect(screen.getByTestId("search-input")).toBeInTheDocument();

    // Check Dropdown is present with correct options
    // "all" is added automatically by the component + 3 mock categories = 4 options
    expect(screen.getByTestId("option-all")).toHaveTextContent(
      "All categories"
    );
    expect(screen.getByTestId("option-Medical")).toHaveTextContent("Medical");

    // Check Status buttons are present
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Expiring soon")).toBeInTheDocument();
  });

  // --- 2. User Interactions (Search, Dropdown, Status) ---

  it("calls onChange when search input is modified", () => {
    render(
      <InventoryFilters
        filters={defaultFilters}
        onChange={mockOnChange}
        categories={mockCategories}
      />
    );

    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "New Search" } });

    expect(mockOnChange).toHaveBeenCalledWith({
      ...defaultFilters,
      search: "New Search",
    });
  });

  it("calls onChange when a category is selected", () => {
    render(
      <InventoryFilters
        filters={defaultFilters}
        onChange={mockOnChange}
        categories={mockCategories}
      />
    );

    const categoryOption = screen.getByTestId("option-Medical");
    fireEvent.click(categoryOption);

    expect(mockOnChange).toHaveBeenCalledWith({
      ...defaultFilters,
      category: "Medical",
    });
  });

  it("calls onChange when a status button is clicked", () => {
    render(
      <InventoryFilters
        filters={defaultFilters}
        onChange={mockOnChange}
        categories={mockCategories}
      />
    );

    const statusBtn = screen.getByRole("button", { name: "Low stock" });
    fireEvent.click(statusBtn);

    expect(mockOnChange).toHaveBeenCalledWith({
      ...defaultFilters,
      status: "LOW_STOCK",
    });
  });

  // --- 3. useEffect Logic (Category Reset) ---

  it("resets category to 'all' if selected category is removed from categories list", () => {
    const filtersWithOldCategory = {
      ...defaultFilters,
      category: "OldCategory",
    };

    const { rerender } = render(
      <InventoryFilters
        filters={filtersWithOldCategory}
        onChange={mockOnChange}
        categories={["OldCategory", "NewCategory"]}
      />
    );

    // Initial render shouldn't trigger change because "OldCategory" exists
    expect(mockOnChange).not.toHaveBeenCalled();

    // Rerender with "OldCategory" removed
    rerender(
      <InventoryFilters
        filters={filtersWithOldCategory}
        onChange={mockOnChange}
        categories={["NewCategory"]}
      />
    );

    // The useEffect should detect mismatch and call onChange
    expect(mockOnChange).toHaveBeenCalledWith({
      ...filtersWithOldCategory,
      category: "all",
    });
  });

  it("does not reset category if category is 'all'", () => {
    const { rerender } = render(
      <InventoryFilters
        filters={{ ...defaultFilters, category: "all" }}
        onChange={mockOnChange}
        categories={["A", "B"]}
      />
    );

    rerender(
      <InventoryFilters
        filters={{ ...defaultFilters, category: "all" }}
        onChange={mockOnChange}
        categories={["B"]}
      />
    );

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  // --- 4. Visual States (Active Styling & Loading) ---

  it("applies active styling to the selected status button", () => {
    const activeStatusFilters = { ...defaultFilters, status: "ACTIVE" };

    render(
      <InventoryFilters
        filters={activeStatusFilters}
        onChange={mockOnChange}
        categories={mockCategories}
      />
    );

    const activeBtn = screen.getByRole("button", { name: "Active" });
    const inactiveBtn = screen.getByRole("button", { name: "All" });

    // Based on logic: status.key === filters.status ? "border! shadow..." : "border-0!"
    expect(activeBtn.className).toContain("shadow");
    expect(inactiveBtn.className).toContain("border-0");

    // Check dynamic style prop (borderColor)
    // Active config: bg: "#E6F4EF", text: "#54B492"
    expect(activeBtn).toHaveStyle("border-color: #54B492");

    // Inactive config: text matches bg
    // All config: bg: "#F7F7F7"
    expect(inactiveBtn).toHaveStyle("border-color: #F7F7F7");
  });

  it("disables inputs when loading prop is true", () => {
    render(
      <InventoryFilters
        filters={defaultFilters}
        onChange={mockOnChange}
        categories={mockCategories}
        loading={true}
      />
    );

    // Check Dropdown disabled state
    const dropdownDisabled = screen.getByTestId("dropdown-disabled");
    expect(dropdownDisabled).toHaveTextContent("true");

    // Check Status buttons disabled state
    const statusBtn = screen.getByRole("button", { name: "All" });
    expect(statusBtn).toBeDisabled();
    expect(statusBtn.className).toContain("cursor-not-allowed");
  });
});
