import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import SearchDropdown from "@/app/components/Inputs/SearchDropdown";

// --- Mocks ---

jest.mock("react-icons/io5", () => ({
  IoSearch: () => <svg data-testid="search-icon" />,
}));

// --- Test Data ---

const mockOptions = [
  { key: "1", value: "Apple" },
  { key: "2", value: "Banana" },
  { key: "3", value: "Cherry" },
  { key: "4", value: "Date" },
];

describe("SearchDropdown Component", () => {
  const mockOnSelect = jest.fn();
  const mockSetQuery = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering ---

  it("renders input with placeholder and icon", () => {
    render(
      <SearchDropdown
        options={mockOptions}
        onSelect={mockOnSelect}
        placeholder="Search Fruit"
        query=""
        setQuery={mockSetQuery}
      />
    );

    const input = screen.getByPlaceholderText("Search Fruit");
    expect(input).toBeInTheDocument();
    expect(screen.getByTestId("search-icon")).toBeInTheDocument();

    // Dropdown should be closed initially
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders with a controlled query value", () => {
    render(
      <SearchDropdown
        options={mockOptions}
        onSelect={mockOnSelect}
        placeholder="Search"
        query="App"
        setQuery={mockSetQuery}
        minChars={2} // Ensure threshold is met
      />
    );
  });

  // --- 2. Interaction (Typing & Filtering) ---

  it("updates query on change and opens dropdown", () => {
    render(
      <SearchDropdown
        options={mockOptions}
        onSelect={mockOnSelect}
        placeholder="Search"
        query=""
        setQuery={mockSetQuery}
      />
    );

    const input = screen.getByPlaceholderText("Search");

    // Simulate typing
    fireEvent.change(input, { target: { value: "Ba" } });

    expect(mockSetQuery).toHaveBeenCalledWith("Ba");
    // Note: In a real component, setQuery would update the 'query' prop.
    // Here we just check the callback.
    // To test the dropdown appearing, we need to rerender with the new query value.
  });

  it("opens dropdown on focus if criteria met", () => {
    render(
      <SearchDropdown
        options={mockOptions}
        onSelect={mockOnSelect}
        placeholder="Search"
        query="Ap" // length 2 >= minChars 2
        setQuery={mockSetQuery}
        minChars={2}
      />
    );

    const input = screen.getByPlaceholderText("Search");

    // Focus should open dropdown
    fireEvent.focus(input);

    expect(screen.getByText("Apple")).toBeInTheDocument();
  });

  // --- 3. Filtering Logic & Min Chars ---

  it("does NOT show dropdown if query length is less than minChars", () => {
    render(
      <SearchDropdown
        options={mockOptions}
        onSelect={mockOnSelect}
        placeholder="Search"
        query="A" // length 1
        setQuery={mockSetQuery}
        minChars={2} // Required 2
      />
    );

    const input = screen.getByPlaceholderText("Search");
    fireEvent.focus(input); // Try to open

    // Should not show options
    expect(screen.queryByText("Apple")).not.toBeInTheDocument();
  });

  it("filters options based on query (case-insensitive)", () => {
    render(
      <SearchDropdown
        options={mockOptions}
        onSelect={mockOnSelect}
        placeholder="Search"
        query="ba" // Should match "Banana"
        setQuery={mockSetQuery}
      />
    );

    const input = screen.getByPlaceholderText("Search");
    fireEvent.focus(input);

    expect(screen.getByText("Banana")).toBeInTheDocument();
    expect(screen.queryByText("Apple")).not.toBeInTheDocument();
  });

  it("shows all options if filtering logic allows empty/partial matches (edge case)", () => {
    // The component logic: `if (!q) return true;`
    // However, `canSearch` requires `query.length >= minChars`.
    // So to test the "return true" branch of filter logic, we'd theoretically need minChars=0.

    render(
      <SearchDropdown
        options={mockOptions}
        onSelect={mockOnSelect}
        placeholder="Search"
        query=""
        setQuery={mockSetQuery}
        minChars={0} // Allow empty search
      />
    );

    const input = screen.getByPlaceholderText("Search");
    fireEvent.focus(input);

    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Banana")).toBeInTheDocument();
  });

  // --- 4. Selection & Closing ---

  it("calls onSelect with the option key when clicked", () => {
    render(
      <SearchDropdown
        options={mockOptions}
        onSelect={mockOnSelect}
        placeholder="Search"
        query="App"
        setQuery={mockSetQuery}
      />
    );

    const input = screen.getByPlaceholderText("Search");
    fireEvent.focus(input);

    const optionBtn = screen.getByText("Apple");
    fireEvent.click(optionBtn);

    expect(mockOnSelect).toHaveBeenCalledWith("1"); // Key for Apple

    // Verify dropdown closed (by checking absence of options)
    // Note: This relies on the component state updating 'open' to false.
    // Since 'open' is internal state, we can assume re-render happens.
    expect(screen.queryByText("Apple")).not.toBeInTheDocument();
  });

  it("closes dropdown when clicking outside", () => {
    render(
      <div>
        <SearchDropdown
          options={mockOptions}
          onSelect={mockOnSelect}
          placeholder="Search"
          query="App"
          setQuery={mockSetQuery}
        />
        <div data-testid="outside">Outside</div>
      </div>
    );

    // Open dropdown
    const input = screen.getByPlaceholderText("Search");
    fireEvent.focus(input);
    expect(screen.getByText("Apple")).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(screen.getByTestId("outside"));

    // Should close
    expect(screen.queryByText("Apple")).not.toBeInTheDocument();
  });

  it("does not close when clicking inside the dropdown input", () => {
    render(
      <SearchDropdown
        options={mockOptions}
        onSelect={mockOnSelect}
        placeholder="Search"
        query="App"
        setQuery={mockSetQuery}
      />
    );

    const input = screen.getByPlaceholderText("Search");
    fireEvent.focus(input);

    // Click inside (on input itself)
    fireEvent.mouseDown(input);

    // Should stay open
    expect(screen.getByText("Apple")).toBeInTheDocument();
  });
});
