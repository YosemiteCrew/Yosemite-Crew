import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import DropdownBuilder from "../../../../../../../pages/Forms/Sections/AddForm/components/Dropdown/DropdownBuilder";
import { FormField } from "@/app/types/forms";

// --- Mocks ---

// Mock FormInput to isolate builder logic from input implementation
jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ value, onChange, inlabel, readonly }: any) => (
    <input
      data-testid={`input-${inlabel}`}
      value={value}
      onChange={onChange}
      placeholder={inlabel}
      readOnly={readonly}
    />
  ),
}));

// Mock crypto.randomUUID
Object.defineProperty(globalThis, "crypto", {
  value: {
    randomUUID: () => "new-uuid-123",
  },
});

describe("DropdownBuilder Component", () => {
  const mockOnChange = jest.fn();

  // Standard mock field for editable dropdown
  const mockField = {
    id: "dd-1",
    type: "dropdown",
    label: "Select Color",
    options: [
      { label: "Red", value: "red" },
      { label: "Blue", value: "blue" },
    ],
  } as FormField & { type: "dropdown" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Rendering (Standard) ---

  it("renders label input and existing options", () => {
    render(<DropdownBuilder field={mockField} onChange={mockOnChange} />);

    // Label input
    expect(screen.getByTestId("input-Label")).toHaveValue("Select Color");

    // Option inputs
    expect(screen.getByTestId("input-Dropdown option 0")).toHaveValue("Red");
    expect(screen.getByTestId("input-Dropdown option 1")).toHaveValue("Blue");

    // Add option button
    expect(screen.getByText("+ Add option")).toBeInTheDocument();
  });

  it("handles missing options array gracefully", () => {
    const emptyField = { ...mockField, options: undefined } as any;
    render(<DropdownBuilder field={emptyField} onChange={mockOnChange} />);

    expect(screen.getByTestId("input-Label")).toBeInTheDocument();
    // No options should be rendered
    expect(
      screen.queryByTestId("input-Dropdown option 0")
    ).not.toBeInTheDocument();
  });

  // --- Section 2: Interactions (Standard) ---

  it("updates field label on change", () => {
    render(<DropdownBuilder field={mockField} onChange={mockOnChange} />);

    const labelInput = screen.getByTestId("input-Label");
    fireEvent.change(labelInput, { target: { value: "Updated Label" } });

    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockField,
      label: "Updated Label",
    });
  });

  it("updates an option label", () => {
    render(<DropdownBuilder field={mockField} onChange={mockOnChange} />);

    const option0Input = screen.getByTestId("input-Dropdown option 0");
    fireEvent.change(option0Input, { target: { value: "Green" } });

    // Expect options array to be updated at index 0
    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockField,
      options: [
        { label: "Green", value: "red" }, // Value persists if it existed
        { label: "Blue", value: "blue" },
      ],
    });
  });

  it("adds a new option", () => {
    render(<DropdownBuilder field={mockField} onChange={mockOnChange} />);

    const addButton = screen.getByText("+ Add option");
    fireEvent.click(addButton);

    // Expect new option with generated UUID and incremented label count
    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockField,
      options: [
        ...mockField.options,
        { label: "Option 3", value: "new-uuid-123" },
      ],
    });
  });

  it("removes an option", () => {
    render(<DropdownBuilder field={mockField} onChange={mockOnChange} />);

    // Find remove buttons (✕)
    const removeButtons = screen.getAllByText("✕");
    // Click remove on the first option (index 0)
    fireEvent.click(removeButtons[0]);

    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockField,
      options: [{ label: "Blue", value: "blue" }],
    });
  });

  // --- Section 3: Read-Only Rendering (Inventory Integration) ---

  it("renders readonly view when meta.readonly is true", () => {
    const readOnlyField = {
      ...mockField,
      meta: { readonly: true },
      defaultValue: "Pre-selected Value",
    } as any;

    render(<DropdownBuilder field={readOnlyField} onChange={mockOnChange} />);

    // Should verify specific readonly labels
    const labelInput = screen.getByTestId("input-Label (from inventory)");
    const valueInput = screen.getByTestId("input-Value (from inventory)");

    expect(labelInput).toHaveValue("Select Color");
    expect(labelInput).toHaveAttribute("readonly");

    expect(valueInput).toHaveValue("Pre-selected Value");
    expect(valueInput).toHaveAttribute("readonly");

    // Should NOT show add option button in readonly mode
    expect(screen.queryByText("+ Add option")).not.toBeInTheDocument();
  });

  // --- Section 4: Edge Cases ---

  it("handles missing label/defaultValue in readonly mode", () => {
    const emptyReadOnlyField = {
      id: "dd-ro",
      type: "dropdown",
      meta: { readonly: true },
      // missing label and defaultValue
    } as any;

    render(
      <DropdownBuilder field={emptyReadOnlyField} onChange={mockOnChange} />
    );

    expect(screen.getByTestId("input-Label (from inventory)")).toHaveValue("");
    expect(screen.getByTestId("input-Value (from inventory)")).toHaveValue("");
  });

  it("handles missing existing value during option update (partial edge case)", () => {
    // Tests the `options[idx]?.value ?? value` fallback logic
    const sparseOptionsField = {
      ...mockField,
      options: [{ label: "Old" }], // value is undefined
    } as any;

    render(
      <DropdownBuilder field={sparseOptionsField} onChange={mockOnChange} />
    );

    const input = screen.getByTestId("input-Dropdown option 0");
    fireEvent.change(input, { target: { value: "New" } });

    expect(mockOnChange).toHaveBeenCalledWith({
      ...sparseOptionsField,
      options: [{ label: "New", value: "New" }], // Fallback to label if value missing
    });
  });
});
