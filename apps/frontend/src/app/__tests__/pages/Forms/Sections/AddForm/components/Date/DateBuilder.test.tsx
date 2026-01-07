import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import DateBuilder from "../../../../../../../pages/Forms/Sections/AddForm/components/Date/DateBuilder";
import { FormField } from "@/app/types/forms";

// --- Mock UI Components ---
// Mock FormInput to test logic without relying on implementation details
jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ value, onChange, inlabel }: any) => (
    <input
      data-testid={`input-${inlabel}`}
      value={value}
      onChange={onChange}
      placeholder={inlabel}
    />
  ),
}));

describe("DateBuilder Component", () => {
  const mockOnChange = jest.fn();

  // Test data strictly typed to match the component's expected prop
  const mockField = {
    id: "date-123",
    type: "date",
    label: "Date of Birth",
    placeholder: "Select a date",
  } as FormField & { type: "date" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Rendering ---

  it("renders correctly with initial values", () => {
    render(<DateBuilder field={mockField} onChange={mockOnChange} />);

    // Verify Label Input
    const labelInput = screen.getByTestId("input-Label");
    expect(labelInput).toBeInTheDocument();
    expect(labelInput).toHaveValue("Date of Birth");

    // Verify Placeholder Input
    const placeholderInput = screen.getByTestId("input-Placeholder");
    expect(placeholderInput).toBeInTheDocument();
    expect(placeholderInput).toHaveValue("Select a date");
  });

  // --- Section 2: Props Handling (Edge Cases) ---

  it("handles undefined label and placeholder gracefully", () => {
    const emptyField = {
      id: "date-empty",
      type: "date",
    } as FormField & { type: "date" }; // Missing label/placeholder

    render(<DateBuilder field={emptyField} onChange={mockOnChange} />);

    expect(screen.getByTestId("input-Label")).toHaveValue("");
    expect(screen.getByTestId("input-Placeholder")).toHaveValue("");
  });

  // --- Section 3: Interactions ---

  it("calls onChange when label input is updated", () => {
    render(<DateBuilder field={mockField} onChange={mockOnChange} />);

    const labelInput = screen.getByTestId("input-Label");
    fireEvent.change(labelInput, { target: { value: "Updated Label" } });

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockField,
      label: "Updated Label",
    });
  });

  it("calls onChange when placeholder input is updated", () => {
    render(<DateBuilder field={mockField} onChange={mockOnChange} />);

    const placeholderInput = screen.getByTestId("input-Placeholder");
    fireEvent.change(placeholderInput, {
      target: { value: "New Placeholder" },
    });

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockField,
      placeholder: "New Placeholder",
    });
  });
});
