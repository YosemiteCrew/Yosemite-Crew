import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Search from "@/app/components/Inputs/Search";

// --- Mocks ---

// Mock IoSearch Icon
jest.mock("react-icons/io5", () => ({
  IoSearch: () => <svg data-testid="search-icon" />,
}));

describe("Search Component", () => {
  const mockSetSearch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering ---

  it("renders correctly with default props", () => {
    render(<Search value="" setSearch={mockSetSearch} />);

    // Check input exists with correct placeholder
    const input = screen.getByPlaceholderText("Search");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("");

    // Check icon exists
    expect(screen.getByTestId("search-icon")).toBeInTheDocument();
  });

  it("renders with a specific initial value", () => {
    render(<Search value="Test Query" setSearch={mockSetSearch} />);

    const input = screen.getByPlaceholderText("Search");
    expect(input).toHaveValue("Test Query");
  });

  // --- 2. Interaction (Typing) ---

  it("calls setSearch when typing in the input", () => {
    render(<Search value="" setSearch={mockSetSearch} />);

    const input = screen.getByPlaceholderText("Search");

    // Simulate typing "Hello"
    fireEvent.change(input, { target: { value: "Hello" } });

    expect(mockSetSearch).toHaveBeenCalledTimes(1);
    // onChange={(e) => setSearch(e.target.value)}
    expect(mockSetSearch).toHaveBeenCalledWith("Hello");
  });

  // --- 3. Optional Props (className) ---

  it("applies custom className correctly", () => {
    render(
      <Search
        value=""
        setSearch={mockSetSearch}
        className="custom-class-test"
      />
    );

    // The component structure is div > input + svg.
    const input = screen.getByPlaceholderText("Search");
    const container = input.parentElement;

    expect(container).toHaveClass("custom-class-test");
    // Should also preserve default classes
    expect(container).toHaveClass("rounded-2xl");
  });

  it("renders correctly without className prop", () => {
    render(
      <Search
        value=""
        setSearch={mockSetSearch}
        // className prop omitted
      />
    );

    const input = screen.getByPlaceholderText("Search");
    const container = input.parentElement;

    // Check default styling logic
    expect(container).toHaveClass("h-10");
    expect(container?.className).not.toContain("undefined");
  });
});
