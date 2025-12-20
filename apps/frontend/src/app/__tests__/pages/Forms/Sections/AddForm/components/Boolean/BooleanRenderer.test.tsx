import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import BooleanRenderer from "../../../../../../../pages/Forms/Sections/AddForm/components/Boolean/BooleanRenderer";
import { FormField } from "@/app/types/forms";

describe("BooleanRenderer Component", () => {
  const mockOnChange = jest.fn();

  // Create a strict mock object matching the expected type
  const mockField = {
    id: "bool-field",
    type: "boolean",
    label: "Agree to terms",
  } as FormField & { type: "boolean" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Rendering ---

  it("renders correctly with initial unchecked state", () => {
    render(
      <BooleanRenderer
        field={mockField}
        value={false}
        onChange={mockOnChange}
      />
    );

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
    expect(screen.getByText("Agree to terms")).toBeInTheDocument();
  });

  it("renders correctly with initial checked state", () => {
    render(
      <BooleanRenderer field={mockField} value={true} onChange={mockOnChange} />
    );

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
  });

  // --- Section 2: Interactions ---

  it("calls onChange with true when unchecked box is clicked", () => {
    render(
      <BooleanRenderer
        field={mockField}
        value={false}
        onChange={mockOnChange}
      />
    );

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(mockOnChange).toHaveBeenCalledWith(true);
  });

  it("calls onChange with false when checked box is clicked", () => {
    render(
      <BooleanRenderer field={mockField} value={true} onChange={mockOnChange} />
    );

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(mockOnChange).toHaveBeenCalledWith(false);
  });

  // --- Section 3: Read-Only State ---

  it("is disabled when readOnly is true", () => {
    render(
      <BooleanRenderer
        field={mockField}
        value={false}
        onChange={mockOnChange}
        readOnly={true}
      />
    );

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeDisabled();

    // Attempt interaction
    fireEvent.click(checkbox);

    // Should NOT trigger change if disabled (though fireEvent usually bypasses,
    // checking the disabled attribute is the key assertion for UI state).
    // Note: standard HTML checkboxes don't fire events when disabled.
  });

  it("is enabled by default (readOnly optional)", () => {
    render(
      <BooleanRenderer
        field={mockField}
        value={false}
        onChange={mockOnChange}
        // readOnly prop omitted
      />
    );

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeEnabled();
  });

  // --- Section 4: Edge Cases & Props ---

  it("handles label interactions (clicking label toggles checkbox)", () => {
    render(
      <BooleanRenderer
        field={mockField}
        value={false}
        onChange={mockOnChange}
      />
    );

    const label = screen.getByText("Agree to terms");
    fireEvent.click(label);

    expect(mockOnChange).toHaveBeenCalledWith(true);
  });

  it("handles null/undefined value gracefully (treats as false)", () => {
    render(
      <BooleanRenderer
        field={mockField}
        value={null as any}
        onChange={mockOnChange}
      />
    );

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
  });
});
