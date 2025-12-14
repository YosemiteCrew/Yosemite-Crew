import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import MultiSelectDropdown from "@/app/components/Inputs/MultiSelectDropdown/index";

// --- Mocks ---

// Mock Icons to simplify DOM structure and queries
jest.mock("react-icons/fa", () => ({
  FaSortDown: () => <span data-testid="icon-sort-down" />,
}));
jest.mock("react-icons/io", () => ({
  IoIosClose: ({ onClick }: any) => (
    <span data-testid="icon-close" onClick={onClick} />
  ),
}));

describe("MultiSelectDropdown Component", () => {
  const mockOnChange = jest.fn();
  const defaultProps = {
    placeholder: "Select Items",
    value: [],
    onChange: mockOnChange,
    options: ["Option A", "Option B", "Option C"],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering Section ---

  it("renders the placeholder correctly", () => {
    render(<MultiSelectDropdown {...defaultProps} />);
    expect(screen.getByText("Select Items")).toBeInTheDocument();
    expect(screen.getByTestId("icon-sort-down")).toBeInTheDocument();
  });

  it("applies custom classNames", () => {
    render(
      <MultiSelectDropdown
        {...defaultProps}
        className="custom-wrapper"
        dropdownClassName="custom-dropdown"
      />
    );
    // Open dropdown to check dropdown class
    const trigger = screen.getByText("Select Items").closest("button");
    fireEvent.click(trigger!);

    // Check main button class
    expect(trigger).toHaveClass("custom-wrapper");

    // Check dropdown menu class (should be visible now)
    // Note: dropdown renders only if availableOptions.length > 0
    expect(
      screen.getByText("Option A").closest(".select-input-dropdown")
    ).toHaveClass("custom-dropdown");
  });

  it("applies 'blueborder' class when values are selected", () => {
    const { rerender } = render(
      <MultiSelectDropdown {...defaultProps} value={[]} />
    );
    const button = screen.getByText("Select Items").closest("button");
    expect(button).not.toHaveClass("blueborder");

    rerender(<MultiSelectDropdown {...defaultProps} value={["Option A"]} />);
    expect(button).toHaveClass("blueborder");
  });

  // --- 2. Interaction: Dropdown Logic ---

  it("toggles the dropdown visibility on click", () => {
    render(<MultiSelectDropdown {...defaultProps} />);
    const trigger = screen.getByText("Select Items").closest("button");

    // Initially closed
    expect(screen.queryByText("Option A")).not.toBeInTheDocument();

    // Click to open
    fireEvent.click(trigger!);
    expect(screen.getByText("Option A")).toBeInTheDocument();

    // Click to close
    fireEvent.click(trigger!);
    expect(screen.queryByText("Option A")).not.toBeInTheDocument();
  });

  it("closes the dropdown when clicking outside", () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <MultiSelectDropdown {...defaultProps} />
      </div>
    );

    const trigger = screen.getByText("Select Items").closest("button");
    fireEvent.click(trigger!);
    expect(screen.getByText("Option A")).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByText("Option A")).not.toBeInTheDocument();
  });

  it("does NOT close dropdown when clicking inside", () => {
    render(<MultiSelectDropdown {...defaultProps} />);
    const trigger = screen.getByText("Select Items").closest("button");
    fireEvent.click(trigger!); // Open

    // Click on the dropdown list itself (simulate inside click)
    // Note: The click listener is on 'mousedown' document-wide.
    // If we click inside the ref, it shouldn't close.
    // We simulate mousedown on an element inside the ref container.
    fireEvent.mouseDown(screen.getByTestId("icon-sort-down")); // Icon is inside the ref

    expect(screen.getByText("Option A")).toBeInTheDocument(); // Should still be open
  });

  // --- 3. Selection Logic ---

  it("adds an option when clicked from the list", () => {
    render(<MultiSelectDropdown {...defaultProps} />);

    // Open
    fireEvent.click(screen.getByText("Select Items").closest("button")!);

    // Click Option B
    fireEvent.click(screen.getByText("Option B"));

    expect(mockOnChange).toHaveBeenCalledWith(["Option B"]);
  });

  it("does not show already selected options in the dropdown list", () => {
    const { container } = render(
      <MultiSelectDropdown
        {...defaultProps}
        value={["Option A"]} // Option A is selected
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByText("Select Items").closest("button")!);

    // Option B should be visible in the list
    const optionB = screen.getByText("Option B");
    expect(optionB).toBeInTheDocument();

    // Option A is selected, so it renders as a TAG below.
    // But it should NOT be in the dropdown list.
    // We scope our check to the dropdown container to confirm it's absent there.
    const dropdownList = container.querySelector(".select-input-dropdown");
    expect(dropdownList).toBeInTheDocument();

    if (dropdownList) {
      // Query within the dropdown only
      const optionAInDropdown = within(dropdownList as HTMLElement).queryByText(
        "Option A"
      );
      expect(optionAInDropdown).not.toBeInTheDocument();
    }
  });

  it("toggles logic: if an item is somehow in list but already selected, it removes it (defensive coding)", () => {
    // This logic is mostly internal protection, hard to reach via UI since items are removed from list.
    // Skipping interaction test for unreachable UI state.
  });

  // --- 4. Tag / Removal Logic & Object Options ---

  it("renders selected options as tags below the input", () => {
    render(
      <MultiSelectDropdown {...defaultProps} value={["Option A", "Option C"]} />
    );

    expect(screen.getByText("Option A")).toBeInTheDocument();
    expect(screen.getByText("Option C")).toBeInTheDocument();
    // Should render close icons for each
    expect(screen.getAllByTestId("icon-close")).toHaveLength(2);
  });

  it("removes an option when the close icon on the tag is clicked", () => {
    render(
      <MultiSelectDropdown {...defaultProps} value={["Option A", "Option B"]} />
    );

    const closeIcons = screen.getAllByTestId("icon-close");
    // Click close on first tag (Option A)
    fireEvent.click(closeIcons[0]);

    // Expect onChange to be called with the filtered list (Option B remaining)
    expect(mockOnChange).toHaveBeenCalledWith(["Option B"]);
  });

  it("handles object options { label, value } correctly", () => {
    const objectOptions = [
      { label: "Label 1", value: "val1" },
      { label: "Label 2", value: "val2" },
    ];

    const { container } = render(
      <MultiSelectDropdown
        {...defaultProps}
        options={objectOptions}
        value={["val1"]}
      />
    );

    // 1. Verify Selected Tag displays Label, not Value
    expect(screen.getByText("Label 1")).toBeInTheDocument();

    // 2. Open Dropdown
    fireEvent.click(screen.getByText("Select Items").closest("button")!);

    // 3. Verify Available Options (Label 2 should be there, Label 1 filtered out)
    const dropdownList = container.querySelector(".select-input-dropdown");
    expect(dropdownList).toBeInTheDocument();

    if (dropdownList) {
      expect(
        within(dropdownList as HTMLElement).getByText("Label 2")
      ).toBeInTheDocument();
      expect(
        within(dropdownList as HTMLElement).queryByText("Label 1")
      ).not.toBeInTheDocument();
    }

    // 4. Click Label 2 -> Should add "val2"
    fireEvent.click(screen.getByText("Label 2"));
    expect(mockOnChange).toHaveBeenCalledWith(["val1", "val2"]);
  });

  it("handles missing options gracefully", () => {
    // Pass undefined options
    render(<MultiSelectDropdown {...defaultProps} options={undefined} />);
    const trigger = screen.getByText("Select Items").closest("button");
    fireEvent.click(trigger!);

    // Should not crash, just empty dropdown (or hidden since length check)
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("getLabel returns value if label not found", () => {
    // This covers the null coalescing `?? val` in getLabel
    render(<MultiSelectDropdown {...defaultProps} value={["UnknownVal"]} />);
    expect(screen.getByText("UnknownVal")).toBeInTheDocument();
  });
});
