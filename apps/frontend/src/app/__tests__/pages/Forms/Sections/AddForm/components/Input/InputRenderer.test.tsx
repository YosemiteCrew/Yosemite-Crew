import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import InputRenderer from "../../../../../../../pages/Forms/Sections/AddForm/components/Input/InputRenderer";
import { FormField } from "@/app/types/forms";

// --- Mock UI Components ---
// Mocking FormInput allows us to inspect the props passed to it,
// specifically 'intype' and 'readonly', to verify the renderer's logic.
jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ value, onChange, inlabel, readonly, intype }: any) => (
    <input
      data-testid="mock-input"
      value={value}
      onChange={onChange}
      aria-label={inlabel}
      readOnly={readonly}
      type={intype}
    />
  ),
}));

describe("InputRenderer Component", () => {
  const mockOnChange = jest.fn();

  const baseField = {
    id: "f1",
    type: "input",
    label: "Test Label",
  } as FormField & { type: "input" | "number" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Rendering & Types ---

  it("renders a text input for 'input' type fields", () => {
    render(
      <InputRenderer field={baseField} value="" onChange={mockOnChange} />
    );

    const input = screen.getByTestId("mock-input");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("aria-label", "Test Label");
  });

  it("renders a number input for 'number' type fields", () => {
    const numField = { ...baseField, type: "number" } as any;

    render(<InputRenderer field={numField} value="" onChange={mockOnChange} />);

    const input = screen.getByTestId("mock-input");
    expect(input).toHaveAttribute("type", "number");
  });

  it("handles missing label gracefully", () => {
    const fieldNoLabel = { ...baseField, label: undefined } as any;

    render(
      <InputRenderer field={fieldNoLabel} value="" onChange={mockOnChange} />
    );

    const input = screen.getByTestId("mock-input");
    expect(input).toHaveAttribute("aria-label", "");
  });

  // --- Section 2: Value Resolution (Priority & Edge Cases) ---

  it("prioritizes the passed 'value' prop", () => {
    render(
      <InputRenderer
        field={baseField}
        value="Current Value"
        onChange={mockOnChange}
      />
    );
    expect(screen.getByTestId("mock-input")).toHaveValue("Current Value");
  });

  it("uses defaultValue if 'value' is undefined/null", () => {
    const fieldWithDefault = { ...baseField, defaultValue: "Default" } as any;

    render(
      <InputRenderer
        field={fieldWithDefault}
        value={undefined as any}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByTestId("mock-input")).toHaveValue("Default");
  });

  it("falls back to empty string if neither value nor defaultValue exist", () => {
    render(
      <InputRenderer
        field={baseField}
        value={undefined as any}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByTestId("mock-input")).toHaveValue("");
  });

  it("correctly handles numeric 0 (should not be treated as falsy/empty)", () => {
    // This tests the use of `??` vs `||` in the component logic
    // value ?? (defaultValue ?? "")

    // Case 1: Value is 0
    const { unmount } = render(
      <InputRenderer
        field={baseField}
        value={0 as any} // simulating number passed as val
        onChange={mockOnChange}
      />
    );
    expect(screen.getByTestId("mock-input")).toHaveValue("0");
    unmount();

    // Case 2: Value undefined, Default is 0
    const fieldZeroDefault = { ...baseField, defaultValue: 0 } as any;
    render(
      <InputRenderer
        field={fieldZeroDefault}
        value={undefined as any}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByTestId("mock-input")).toHaveValue("0");
  });

  // --- Section 3: Interactions ---

  it("calls onChange when input value changes", () => {
    render(
      <InputRenderer field={baseField} value="" onChange={mockOnChange} />
    );

    const input = screen.getByTestId("mock-input");
    fireEvent.change(input, { target: { value: "New Input" } });

    expect(mockOnChange).toHaveBeenCalledWith("New Input");
  });

  // --- Section 4: Read-Only Logic ---

  it("is read-only when readOnly prop is true", () => {
    render(
      <InputRenderer
        field={baseField}
        value="Read Only Val"
        onChange={mockOnChange}
        readOnly={true}
      />
    );

    const input = screen.getByTestId("mock-input");
    expect(input).toHaveAttribute("readonly");

    // Attempt change
    fireEvent.change(input, { target: { value: "Try Change" } });
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it("is read-only when field.meta.readonly is true", () => {
    const readOnlyMetaField = {
      ...baseField,
      meta: { readonly: true },
    } as any;

    render(
      <InputRenderer
        field={readOnlyMetaField}
        value="Meta Read Only"
        onChange={mockOnChange}
        // Prop is false/undefined by default, but meta should take precedence
      />
    );

    const input = screen.getByTestId("mock-input");
    expect(input).toHaveAttribute("readonly");

    // Attempt change
    fireEvent.change(input, { target: { value: "Try Change" } });
    expect(mockOnChange).not.toHaveBeenCalled();
  });
});
