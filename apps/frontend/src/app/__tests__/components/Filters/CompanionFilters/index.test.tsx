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

    // Search
    expect(screen.getByTestId("search-input")).toBeInTheDocument();
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

  it("filters by Search matching Companion Name", () => {
    render(
      <CompanionFilters list={mockList} setFilteredList={mockSetFilteredList} />
    );

    const searchInput = screen.getByTestId("search-input");

    // Search "Whisk" (Whiskers)
    fireEvent.change(searchInput, { target: { value: "Whisk" } });

    // Matches: Whiskers (Cat/Active)
    expect(mockSetFilteredList).toHaveBeenLastCalledWith([mockList[1]]);
  });

  it("filters by Search matching Parent Name", () => {
    render(
      <CompanionFilters list={mockList} setFilteredList={mockSetFilteredList} />
    );

    const searchInput = screen.getByTestId("search-input");

    // Search "John" (Buddy's parent)
    fireEvent.change(searchInput, { target: { value: "John" } });

    // Matches: Buddy (Dog/Active - Parent John)
    expect(mockSetFilteredList).toHaveBeenLastCalledWith([mockList[0]]);
  });

  // --- 4. Complex Combinations & Styling ---

  it("filters correctly with Species + Status + Search combined", () => {
    render(
      <CompanionFilters list={mockList} setFilteredList={mockSetFilteredList} />
    );

    // 1. Set Status to Inactive
    fireEvent.click(screen.getByText("Inactive"));

    // 2. Set Species to Dog
    fireEvent.click(screen.getByText("Dog"));

    // 3. Search "Shadow"
    fireEvent.change(screen.getByTestId("search-input"), {
      target: { value: "Shadow" },
    });

    // Should match Shadow (Dog / Inactive(null) / Name match)
    expect(mockSetFilteredList).toHaveBeenLastCalledWith([mockList[4]]);
  });

  it("applies active styles to selected buttons", () => {
    render(
      <CompanionFilters list={mockList} setFilteredList={mockSetFilteredList} />
    );

    const allBtn = screen.getByText("All");
    const dogBtn = screen.getByText("Dog");
    const activeBtn = screen.getByText("Active");
    const inactiveBtn = screen.getByText("Inactive");

    // Default Active States
    expect(allBtn.className).toContain("bg-blue-light!");
    expect(dogBtn.className).not.toContain("bg-blue-light!");
    expect(activeBtn).toHaveStyle("border-color: #54B492"); // Active text color

    // Interaction
    fireEvent.click(dogBtn);
    fireEvent.click(inactiveBtn);

    // New Active States
    expect(dogBtn.className).toContain("bg-blue-light!");
    expect(allBtn.className).not.toContain("bg-blue-light!");

    // Inactive button style check (dynamic style prop)
    // inactive config: text: "#F68523"
    expect(inactiveBtn).toHaveStyle("border-color: #F68523");
    // Active button is no longer selected, should fallback to bg color for border
    expect(activeBtn).toHaveStyle("border-color: #E6F4EF");
  });
});
