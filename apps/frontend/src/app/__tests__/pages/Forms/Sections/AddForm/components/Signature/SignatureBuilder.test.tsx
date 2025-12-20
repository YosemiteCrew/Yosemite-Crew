import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import SignatureBuilder from "../../../../../../../pages/Forms/Sections/AddForm/components/Signature/SignatureBuilder";
import { FormField } from "@/app/types/forms";

// --- Mock UI Components ---
// Mock FormInput to isolate the builder logic
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

describe("SignatureBuilder Component", () => {
  const mockOnChange = jest.fn();

  // Test data strictly typed
  const mockField = {
    id: "sig-123",
    type: "signature",
    label: "Customer Signature",
  } as FormField;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Rendering ---

  it("renders the builder correctly", () => {
    render(<SignatureBuilder field={mockField} onChange={mockOnChange} />);

    const input = screen.getByTestId("mock-input");
    expect(input).toBeInTheDocument();
  });

  // --- Section 2: Props & Logic ---

  it("displays the correct initial label", () => {
    render(<SignatureBuilder field={mockField} onChange={mockOnChange} />);

    const input = screen.getByTestId("mock-input");
    expect(input).toHaveValue("Customer Signature");
  });

  it("handles undefined label gracefully (falls back to empty string)", () => {
    const fieldNoLabel = { ...mockField, label: undefined } as any;

    render(<SignatureBuilder field={fieldNoLabel} onChange={mockOnChange} />);

    const input = screen.getByTestId("mock-input");
    expect(input).toHaveValue("");
  });

  // --- Section 3: Interactions ---

  it("calls onChange with updated label when input changes", () => {
    render(<SignatureBuilder field={mockField} onChange={mockOnChange} />);

    const input = screen.getByTestId("mock-input");

    // Simulate user typing a new label
    fireEvent.change(input, { target: { value: "Manager Signature" } });

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockField,
      label: "Manager Signature",
    });
  });
});
