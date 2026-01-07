import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import TextBuilder from "../../../../../../../pages/Forms/Sections/AddForm/components/Text/TextBuilder";
import { FormField } from "@/app/types/forms";

// --- Mock UI Components ---
// Mock FormInput (single line) and FormDesc (multiline/textarea)
// to verify they receive the correct props and trigger callbacks.

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ value, onChange, inlabel }: any) => (
    <input
      data-testid="mock-label-input"
      value={value}
      onChange={onChange}
      aria-label={inlabel}
    />
  ),
}));

jest.mock("@/app/components/Inputs/FormDesc/FormDesc", () => ({
  __esModule: true,
  default: ({ value, onChange, inlabel }: any) => (
    <textarea
      data-testid="mock-desc-input"
      value={value}
      onChange={onChange}
      aria-label={inlabel}
    />
  ),
}));

describe("TextBuilder Component", () => {
  const mockOnChange = jest.fn();

  // Strict mock object matching the required type
  const mockField = {
    id: "text-123",
    type: "textarea",
    label: "Comments",
    placeholder: "Enter details here...",
  } as FormField & { type: "textarea" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Rendering ---

  it("renders Label input and Placeholder textarea correctly", () => {
    render(<TextBuilder field={mockField} onChange={mockOnChange} />);

    // Verify Label Input
    const labelInput = screen.getByTestId("mock-label-input");
    expect(labelInput).toBeInTheDocument();
    expect(labelInput).toHaveValue("Comments");
    expect(labelInput).toHaveAttribute("aria-label", "Label");

    // Verify Placeholder Input (FormDesc)
    const placeholderInput = screen.getByTestId("mock-desc-input");
    expect(placeholderInput).toBeInTheDocument();
    expect(placeholderInput).toHaveValue("Enter details here...");
    expect(placeholderInput).toHaveAttribute("aria-label", "Placeholder");
  });

  // --- Section 2: Edge Cases (Props) ---

  it("handles undefined label and placeholder gracefully", () => {
    const emptyField = {
      id: "text-empty",
      type: "textarea",
      // label and placeholder are undefined
    } as FormField & { type: "textarea" };

    render(<TextBuilder field={emptyField} onChange={mockOnChange} />);

    expect(screen.getByTestId("mock-label-input")).toHaveValue("");
    expect(screen.getByTestId("mock-desc-input")).toHaveValue("");
  });

  // --- Section 3: Interactions ---

  it("calls onChange when Label is updated", () => {
    render(<TextBuilder field={mockField} onChange={mockOnChange} />);

    const labelInput = screen.getByTestId("mock-label-input");
    fireEvent.change(labelInput, { target: { value: "Feedback" } });

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockField,
      label: "Feedback",
    });
  });

  it("calls onChange when Placeholder is updated", () => {
    render(<TextBuilder field={mockField} onChange={mockOnChange} />);

    const placeholderInput = screen.getByTestId("mock-desc-input");
    fireEvent.change(placeholderInput, {
      target: { value: "Updated placeholder" },
    });

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockField,
      placeholder: "Updated placeholder",
    });
  });
});
