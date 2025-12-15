import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import Dropdown from "@/app/components/Inputs/Dropdown/Dropdown";

// --- Mocks ---

// Mock Icons
jest.mock("react-icons/fa", () => ({
  FaSortDown: () => <span data-testid="icon-sort-down">SortDown</span>,
}));
jest.mock("react-icons/io5", () => ({
  IoSearch: () => <span data-testid="icon-search">Search</span>,
}));
jest.mock("@iconify/react/dist/iconify.js", () => ({
  Icon: () => <span data-testid="icon-error">ErrorIcon</span>,
}));

// Mock Country List
jest.mock("@/app/utils/countryList.json", () => [
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
]);

describe("Dropdown Component", () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering ---

  it("renders correctly with placeholder", () => {
    render(
      <Dropdown placeholder="Select Item" value="" onChange={mockOnChange} />
    );

    expect(screen.getByText("Select Item")).toBeInTheDocument();
    expect(screen.queryByText("SortDown")).toBeInTheDocument();
  });

  it("renders with a selected value (String option)", () => {
    render(
      <Dropdown
        placeholder="Select Item"
        value="Option 1"
        options={["Option 1", "Option 2"]}
        onChange={mockOnChange}
      />
    );

    // Should verify the selected label is displayed
    expect(screen.getByText("Option 1")).toBeInTheDocument();
    // The placeholder should still be there as a label
    expect(screen.getByText("Select Item")).toBeInTheDocument();
  });

  it("renders error message when error prop is present", () => {
    render(
      <Dropdown
        placeholder="Select Item"
        value=""
        onChange={mockOnChange}
        error="Field is required"
      />
    );

    expect(screen.getByText("Field is required")).toBeInTheDocument();
    expect(screen.getByTestId("icon-error")).toBeInTheDocument();
  });

  it("renders disabled state correctly", () => {
    render(
      <Dropdown
        placeholder="Select Item"
        value=""
        onChange={mockOnChange}
        disabled
      />
    );

    const button = screen.getByRole("button");
    // Check if pointer events class logic is applied via classNames
    expect(button.className).toContain("pointer-events-none");

    // Attempt click
    fireEvent.click(button);
    // Should not open (query for dropdown content should fail)
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument(); // assuming standard role or just absence of options
    expect(screen.queryByText("SortDown")).toBeInTheDocument(); // Icon stays
  });

  // --- 2. Interaction: Opening & Closing ---

  it("opens dropdown on click and closes on second click", () => {
    render(
      <Dropdown
        placeholder="Select"
        value=""
        onChange={mockOnChange}
        options={["A", "B"]}
      />
    );

    const button = screen.getByRole("button");

    // Open
    fireEvent.click(button);
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();

    // Close
    fireEvent.click(button);
    expect(screen.queryByText("A")).not.toBeInTheDocument();
  });

  it("closes dropdown when clicking outside", () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <Dropdown
          placeholder="Select"
          value=""
          onChange={mockOnChange}
          options={["A"]}
        />
      </div>
    );

    // Open
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("A")).toBeInTheDocument();

    // Click Outside
    fireEvent.mouseDown(screen.getByTestId("outside"));

    // Check if closed
    expect(screen.queryByText("A")).not.toBeInTheDocument();
  });

  // --- 3. Option Logic & Types ---

  it("handles string options selection", () => {
    render(
      <Dropdown
        placeholder="Select"
        value=""
        onChange={mockOnChange}
        options={["Option A", "Option B"]}
      />
    );

    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("Option B"));

    expect(mockOnChange).toHaveBeenCalledWith("Option B");
    // Should close after selection
    expect(screen.queryByText("Option A")).not.toBeInTheDocument();
  });

  it("handles object options ({ label, value }) selection", () => {
    const options = [
      { label: "Label 1", value: "val1" },
      { label: "Label 2", value: "val2" },
    ];
    render(
      <Dropdown
        placeholder="Select"
        value=""
        onChange={mockOnChange}
        options={options}
      />
    );

    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("Label 2"));

    expect(mockOnChange).toHaveBeenCalledWith("val2");
  });

  it("handles object options with missing value (uses label or index)", () => {
    // Covering the complex mapping logic in useMemo
    const options = [
      { label: "Only Label" }, // Should use label as value? Code says: value: val ?? "" where val = option.value ?? option.label ?? index
      // So if value missing, it uses label.
    ] as any;

    render(
      <Dropdown
        placeholder="Select"
        value=""
        onChange={mockOnChange}
        options={options}
      />
    );

    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("Only Label"));

    expect(mockOnChange).toHaveBeenCalledWith("Only Label");
  });

  it("handles type='country' correctly", () => {
    render(
      <Dropdown
        placeholder="Select Country"
        value=""
        onChange={mockOnChange}
        type="country"
      />
    );

    fireEvent.click(screen.getByRole("button"));

    // Check mocked country list rendering
    // Label format: `${option.flag} ${option.name}`
    expect(screen.getByText("🇺🇸 United States")).toBeInTheDocument();

    fireEvent.click(screen.getByText("🇺🇸 United States"));
    // Value format: option.name
    expect(mockOnChange).toHaveBeenCalledWith("United States");
  });

  it("handles type='breed' correctly", () => {
    const breedOptions = [
      { breedId: 101, breedName: "Golden Retriever" },
      { breedId: 102, breedName: "Poodle" },
    ] as any;

    render(
      <Dropdown
        placeholder="Select Breed"
        value=""
        onChange={mockOnChange}
        type="breed"
        options={breedOptions}
      />
    );

    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Golden Retriever")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Poodle"));
    expect(mockOnChange).toHaveBeenCalledWith("Poodle");
  });

  it("handles mixed/fallback option types", () => {
    // Cover the code path: const str = String(option ?? index);
    const options = [123, null] as any;

    render(
      <Dropdown
        placeholder="Mix"
        value=""
        onChange={mockOnChange}
        options={options}
      />
    );

    fireEvent.click(screen.getByRole("button"));

    // Index 0: 123 -> String(123)
    expect(screen.getByText("123")).toBeInTheDocument();

    // Index 1: null -> String(null ?? 1) -> "1"
    // Wait, option ?? index -> null ?? 1 -> 1.
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  // --- 4. Search Functionality ---

  it("filters list when search is enabled and query is typed", () => {
    render(
      <Dropdown
        placeholder="Select"
        value=""
        onChange={mockOnChange}
        options={["Apple", "Banana", "Cherry"]}
        search={true}
      />
    );

    // Open
    fireEvent.click(screen.getByRole("button"));

    // Find Search Input
    const searchInput = screen.getByPlaceholderText("Search");
    expect(searchInput).toBeInTheDocument();
    expect(screen.getByTestId("icon-search")).toBeInTheDocument();

    // Type "Ban"
    fireEvent.change(searchInput, { target: { value: "Ban" } });

    // Verify Filter
    expect(screen.getByText("Banana")).toBeInTheDocument();
    expect(screen.queryByText("Apple")).not.toBeInTheDocument();
    expect(screen.queryByText("Cherry")).not.toBeInTheDocument();
  });

  it("clears search query upon selection", () => {
    render(
      <Dropdown
        placeholder="Select"
        value=""
        onChange={mockOnChange}
        options={["Apple", "Banana"]}
        search={true}
      />
    );

    // Open & Search
    fireEvent.click(screen.getByRole("button"));
    const searchInput = screen.getByPlaceholderText("Search");
    fireEvent.change(searchInput, { target: { value: "App" } });

    // Select
    fireEvent.click(screen.getByText("Apple"));
    expect(mockOnChange).toHaveBeenCalledWith("Apple");

    // Re-open to verify search cleared
    fireEvent.click(screen.getByRole("button"));

    // Apple and Banana should both be visible again
    expect(screen.getByText("Banana")).toBeInTheDocument();
    // Input value should be empty (though we might not be able to easily check the internal state value unless we find by display value, but the fact Banana is visible proves query is empty)
  });

  it("renders correctly with custom dropdownClassName", () => {
    render(
      <Dropdown
        placeholder="Class Test"
        value=""
        onChange={mockOnChange}
        options={["A"]}
        dropdownClassName="custom-class-test"
      />
    );

    fireEvent.click(screen.getByRole("button"));
    // We look for the container having this class.
    // The container is the div wrapping options.
    const optionA = screen.getByText("A");
    const container = optionA.parentElement;
    expect(container).toHaveClass("custom-class-test");
  });
});
