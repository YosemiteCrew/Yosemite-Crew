import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import InputBuilder from "../../../../../../../pages/Forms/Sections/AddForm/components/Input/InputBuilder";
import { FormField } from "@/app/types/forms";

// --- Mock UI Components ---
// We mock FormInput to capture props like 'intype' and 'readonly' to ensure the builder logic passes them correctly.
jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ value, onChange, inlabel, readonly, intype }: any) => (
    <input
      data-testid={`input-${inlabel}`}
      value={value}
      onChange={onChange}
      placeholder={inlabel}
      readOnly={readonly}
      type={intype}
    />
  ),
}));

describe("InputBuilder Component", () => {
  const mockOnChange = jest.fn();

  const baseField = {
    id: "f1",
    type: "input",
    label: "Full Name",
    placeholder: "Enter name",
  } as FormField & { type: "input" | "number" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Standard Rendering & Editing ---

  it("renders Label and Placeholder inputs for standard fields", () => {
    render(<InputBuilder field={baseField} onChange={mockOnChange} />);

    const labelInput = screen.getByTestId("input-Label");
    const placeholderInput = screen.getByTestId("input-Placeholder");

    expect(labelInput).toHaveValue("Full Name");
    expect(labelInput).not.toHaveAttribute("readonly");

    expect(placeholderInput).toHaveValue("Enter name");
    expect(placeholderInput).toHaveAttribute("type", "text"); // Default type
  });

  it("calls onChange when Label is updated", () => {
    render(<InputBuilder field={baseField} onChange={mockOnChange} />);

    const labelInput = screen.getByTestId("input-Label");
    fireEvent.change(labelInput, { target: { value: "New Label" } });

    expect(mockOnChange).toHaveBeenCalledWith({
      ...baseField,
      label: "New Label",
    });
  });

  it("calls onChange when Placeholder is updated", () => {
    render(<InputBuilder field={baseField} onChange={mockOnChange} />);

    const placeholderInput = screen.getByTestId("input-Placeholder");
    fireEvent.change(placeholderInput, { target: { value: "New Hint" } });

    expect(mockOnChange).toHaveBeenCalledWith({
      ...baseField,
      placeholder: "New Hint",
    });
  });

  // --- Section 2: Type Handling (Number vs Text) ---

  it("sets input type to 'number' when field type is 'number'", () => {
    const numberField = { ...baseField, type: "number" } as any;

    render(<InputBuilder field={numberField} onChange={mockOnChange} />);

    const placeholderInput = screen.getByTestId("input-Placeholder");
    expect(placeholderInput).toHaveAttribute("type", "number");
  });

  it("sets input type to 'text' when field type is 'input'", () => {
    // Already tested in Section 1, but explicit verification here
    const inputField = { ...baseField, type: "input" } as any;

    render(<InputBuilder field={inputField} onChange={mockOnChange} />);

    const placeholderInput = screen.getByTestId("input-Placeholder");
    expect(placeholderInput).toHaveAttribute("type", "text");
  });

  // --- Section 3: Read-Only / Inventory Logic ---

  it("renders read-only view when meta.readonly is true", () => {
    const readOnlyField = {
      ...baseField,
      meta: { readonly: true },
      defaultValue: "Inventory Value",
    } as any;

    render(<InputBuilder field={readOnlyField} onChange={mockOnChange} />);

    // Expect specific inventory labels
    const labelInput = screen.getByTestId("input-Label (from inventory)");
    const valueInput = screen.getByTestId("input-Value (from inventory)");

    // Verify ReadOnly attributes
    expect(labelInput).toHaveAttribute("readonly");
    expect(valueInput).toHaveAttribute("readonly");

    // Verify Values
    expect(labelInput).toHaveValue("Full Name");
    expect(valueInput).toHaveValue("Inventory Value");
  });

  it("prioritizes defaultValue over placeholder in read-only mode", () => {
    const field = {
      ...baseField,
      meta: { readonly: true },
      defaultValue: "Default",
      placeholder: "Placeholder",
    } as any;

    render(<InputBuilder field={field} onChange={mockOnChange} />);
    expect(screen.getByTestId("input-Value (from inventory)")).toHaveValue(
      "Default"
    );
  });

  it("falls back to placeholder if defaultValue is missing in read-only mode", () => {
    const field = {
      ...baseField,
      meta: { readonly: true },
      defaultValue: undefined,
      placeholder: "Placeholder Fallback",
    } as any;

    render(<InputBuilder field={field} onChange={mockOnChange} />);
    expect(screen.getByTestId("input-Value (from inventory)")).toHaveValue(
      "Placeholder Fallback"
    );
  });

  // --- Section 4: Edge Cases ---

  it("handles missing label/placeholder properties gracefully (Standard)", () => {
    const emptyField = { id: "f1", type: "input" } as any;

    render(<InputBuilder field={emptyField} onChange={mockOnChange} />);

    expect(screen.getByTestId("input-Label")).toHaveValue("");
    expect(screen.getByTestId("input-Placeholder")).toHaveValue("");
  });

  it("handles missing label/values gracefully (Read-Only)", () => {
    const emptyReadOnlyField = {
      id: "f1",
      type: "input",
      meta: { readonly: true },
      // No label, placeholder, or defaultValue
    } as any;

    render(<InputBuilder field={emptyReadOnlyField} onChange={mockOnChange} />);

    expect(screen.getByTestId("input-Label (from inventory)")).toHaveValue("");
    expect(screen.getByTestId("input-Value (from inventory)")).toHaveValue("");
  });
});
