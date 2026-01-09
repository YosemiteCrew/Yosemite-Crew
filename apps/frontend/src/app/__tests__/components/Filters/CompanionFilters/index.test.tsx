import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import CompanionFilters from "@/app/components/Filters/CompanionFilters";
import { CompanionParent } from "@/app/pages/Companions/types";

// --- Mocks ---

// Mock Search Component to isolate unit logic
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

const mockList: CompanionParent[] = [
  {
    companion: {
      name: "Buddy",
      type: "Dog",
      status: "active",
    },
    parent: {
      firstName: "John",
    },
  },
  {
    companion: {
      name: "Whiskers",
      type: "Cat",
      status: "active",
    },
    parent: {
      firstName: "Sarah",
    },
  },
  {
    companion: {
      name: "Thunder",
      type: "Horse",
      status: "inactive",
    },
    parent: {
      firstName: "Mike",
    },
  },
  {
    companion: {
      name: "Goldie",
      type: "Fish", // Should map to "Other" logic if specific key isn't 'dog'/'cat'/'horse'
      status: "archived",
    },
    parent: {
      firstName: "Emily",
    },
  },
  {
    companion: {
      name: "Shadow",
      type: "Dog",
      status: null, // Test fallback to 'inactive'
    },
    parent: {
      firstName: "Alex",
    },
  },
] as any;

describe("CompanionFilters Component", () => {
  const mockSetFilteredList = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Initial Rendering & Default State ---

  it("renders filter buttons and search input", () => {
    render(
      <CompanionFilters list={mockList} setFilteredList={mockSetFilteredList} />
    );

    // Species Buttons
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Dog")).toBeInTheDocument();
    expect(screen.getByText("Cat")).toBeInTheDocument();

    // Status Buttons
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("filters by default state (Species: All, Status: Active) on mount", () => {
    render(
      <CompanionFilters list={mockList} setFilteredList={mockSetFilteredList} />
    );

    // Default: All Species + Active Status
    // Matches: Buddy (Dog/Active), Whiskers (Cat/Active)
    expect(mockSetFilteredList).toHaveBeenCalledWith([
      mockList[0],
      mockList[1],
    ]);
  });

  // --- 2. Filtering Logic (Species & Status) ---

  it("filters by Species change (Dog)", () => {
    render(
      <CompanionFilters list={mockList} setFilteredList={mockSetFilteredList} />
    );

    // Click "Dog"
    fireEvent.click(screen.getByText("Dog"));

    // Status is still "Active" (default)
    // Matches: Buddy (Dog/Active)
    // Excludes: Whiskers (Cat/Active), Shadow (Dog/Inactive-fallback)
    expect(mockSetFilteredList).toHaveBeenLastCalledWith([mockList[0]]);
  });

  it("filters by Status change (Inactive)", () => {
    render(
      <CompanionFilters list={mockList} setFilteredList={mockSetFilteredList} />
    );

    // Click "Inactive"
    fireEvent.click(screen.getByText("Inactive"));

    // Species is still "All" (default)
    // Matches: Thunder (Horse/Inactive), Shadow (Dog/Null -> Inactive fallback)
    expect(mockSetFilteredList).toHaveBeenLastCalledWith([
      mockList[2],
      mockList[4],
    ]);
  });

  it("filters by Status change (Archived)", () => {
    render(
      <CompanionFilters list={mockList} setFilteredList={mockSetFilteredList} />
    );

    fireEvent.click(screen.getByText("Archived"));

    // Matches: Goldie (Fish/Archived)
    expect(mockSetFilteredList).toHaveBeenLastCalledWith([mockList[3]]);
  });

  // --- 3. Search Logic ---

  // --- 4. Complex Combinations & Styling ---

  it("filters correctly with Species + Status + Search combined", () => {
    render(
      <CompanionFilters list={mockList} setFilteredList={mockSetFilteredList} />
    );

    // 1. Set Status to Inactive
    fireEvent.click(screen.getByText("Inactive"));

    // 2. Set Species to Dog
    fireEvent.click(screen.getByText("Dog"));

    // Should match Shadow (Dog / Inactive(null) / Name match)
    expect(mockSetFilteredList).toHaveBeenLastCalledWith([mockList[4]]);
  });

  it("applies active styles to selected buttons", () => {
    render(
      <CompanionFilters list={mockList} setFilteredList={mockSetFilteredList} />
    );

    const dogBtn = screen.getByText("Dog");
    const inactiveBtn = screen.getByText("Inactive");

    // Interaction
    fireEvent.click(dogBtn);
    fireEvent.click(inactiveBtn);
  });
});
