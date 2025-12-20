import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import DateRenderer from "../../../../../../../pages/Forms/Sections/AddForm/components/Date/DateRenderer";
import { FormField } from "@/app/types/forms";

// --- Mock UI Components ---
// Mocking FormInput allows us to test prop passing and interaction logic
// without needing the full complexity of the input component.
jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ value, onChange, inlabel, readonly, onFocus, onClick }: any) => (
    <input
      data-testid="mock-date-input"
      type="date"
      value={value}
      onChange={onChange}
      aria-label={inlabel}
      readOnly={readonly}
      onFocus={onFocus}
      onClick={onClick}
    />
  ),
}));

describe("DateRenderer Component", () => {
  const mockOnChange = jest.fn();

  // Strict mock object matching the required type
  const mockField = {
    id: "date-field",
    type: "date",
    label: "Birth Date",
  } as FormField & { type: "date" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Rendering ---

  it("renders correctly with provided value and label", () => {
    render(
      <DateRenderer
        field={mockField}
        value="2023-01-01"
        onChange={mockOnChange}
      />
    );

    const input = screen.getByTestId("mock-date-input");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("2023-01-01");
    // Verify label passing logic
    expect(input).toHaveAttribute("aria-label", "Birth Date");
  });

  it("renders default label 'Date' if field label is missing", () => {
    const fieldNoLabel = { ...mockField, label: undefined } as any;

    render(
      <DateRenderer field={fieldNoLabel} value="" onChange={mockOnChange} />
    );

    const input = screen.getByTestId("mock-date-input");
    expect(input).toHaveAttribute("aria-label", "Date");
  });

  // --- Section 2: Interactions ---

  it("calls onChange when date is selected", () => {
    render(<DateRenderer field={mockField} value="" onChange={mockOnChange} />);

    const input = screen.getByTestId("mock-date-input");
    fireEvent.change(input, { target: { value: "2023-12-25" } });

    expect(mockOnChange).toHaveBeenCalledWith("2023-12-25");
  });

  // --- Section 3: Read-Only Behavior ---

  it("sets input to readOnly when readOnly prop is true", () => {
    render(
      <DateRenderer
        field={mockField}
        value="2023-01-01"
        onChange={mockOnChange}
        readOnly={true}
      />
    );

    const input = screen.getByTestId("mock-date-input");
    expect(input).toHaveAttribute("readonly");
  });

  it("blurs on focus when readOnly is true", () => {
    render(
      <DateRenderer
        field={mockField}
        value=""
        onChange={mockOnChange}
        readOnly={true}
      />
    );

    const input = screen.getByTestId("mock-date-input");
    const blurSpy = jest.spyOn(input, "blur");

    // Simulate focus event
    fireEvent.focus(input);

    expect(blurSpy).toHaveBeenCalled();
  });

  it("prevents default and blurs on click when readOnly is true", () => {
    render(
      <DateRenderer
        field={mockField}
        value=""
        onChange={mockOnChange}
        readOnly={true}
      />
    );

    const input = screen.getByTestId("mock-date-input");
    const blurSpy = jest.spyOn(input, "blur");

    // Create a custom click event to spy on preventDefault
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = jest.spyOn(clickEvent, "preventDefault");

    fireEvent(input, clickEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(blurSpy).toHaveBeenCalled();
  });

  // --- Section 4: Standard Behavior (Not Read-Only) ---

  it("allows normal interactions when readOnly is false (default)", () => {
    render(<DateRenderer field={mockField} value="" onChange={mockOnChange} />);

    const input = screen.getByTestId("mock-date-input");
    const blurSpy = jest.spyOn(input, "blur");

    // Focus should NOT blur
    fireEvent.focus(input);
    expect(blurSpy).not.toHaveBeenCalled();

    // Click should NOT prevent default
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = jest.spyOn(clickEvent, "preventDefault");

    fireEvent(input, clickEvent);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });
});
