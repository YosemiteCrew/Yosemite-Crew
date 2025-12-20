import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import BooleanBuilder from "../../../../../../../pages/Forms/Sections/AddForm/components/Boolean/BooleanBuilder";
import { FormField } from "@/app/types/forms";

// --- Mock UI Components ---
// Mocking FormInput allows us to test the logic of passing props and handling changes
// without relying on the implementation details of the input component itself.
jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ value, onChange, inlabel }: any) => (
    <input
      data-testid="mock-input"
      value={value}
      onChange={onChange}
      aria-label={inlabel}
    />
  ),
}));

describe("BooleanBuilder Component", () => {
  const mockOnChange = jest.fn();

  // Test data strictly typed to match the component's expected prop
  const mockField = {
    id: "bool-123",
    type: "boolean",
    label: "Yes/No Question",
  } as FormField & { type: "boolean" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Rendering ---

  it("renders correctly", () => {
    render(<BooleanBuilder field={mockField} onChange={mockOnChange} />);

    // Verify the input is rendered
    expect(screen.getByTestId("mock-input")).toBeInTheDocument();
  });

  // --- Section 2: Props Handling ---

  it("displays the initial label correctly", () => {
    render(<BooleanBuilder field={mockField} onChange={mockOnChange} />);

    const input = screen.getByTestId("mock-input");
    expect(input).toHaveValue("Yes/No Question");
  });

  it("handles undefined/missing label gracefully (displays empty string)", () => {
    const fieldWithNoLabel = { ...mockField, label: undefined } as any;

    render(<BooleanBuilder field={fieldWithNoLabel} onChange={mockOnChange} />);

    const input = screen.getByTestId("mock-input");
    expect(input).toHaveValue("");
  });

  // --- Section 3: Interactions ---

  it("calls onChange with updated label when input changes", () => {
    render(<BooleanBuilder field={mockField} onChange={mockOnChange} />);

    const input = screen.getByTestId("mock-input");

    // Simulate typing
    fireEvent.change(input, { target: { value: "Updated Label" } });

    // Verify the parent function was called
    expect(mockOnChange).toHaveBeenCalledTimes(1);

    // Verify the arguments passed match the expected update
    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockField,
      label: "Updated Label",
    });
  });
});
