import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import DropdownRenderer from "../../../../../../../pages/Forms/Sections/AddForm/components/Dropdown/DropdownRenderer";

// --- Mocks ---

// Mock the Dropdown component to isolate logic and easily test prop passing
jest.mock("@/app/components/Inputs/Dropdown/Dropdown", () => ({
  __esModule: true,
  default: ({ value, onChange, disabled, options, placeholder }: any) => (
    <div data-testid="mock-dropdown">
      <span data-testid="dropdown-value">{JSON.stringify(value)}</span>
      <span data-testid="dropdown-disabled">{String(disabled)}</span>
      <span data-testid="dropdown-placeholder">{placeholder}</span>
      <div data-testid="dropdown-options">
        {options.map((o: any) => (
          <button
            key={o.value}
            data-testid={`option-${o.value}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  ),
}));

describe("DropdownRenderer Component", () => {
  const mockOnChange = jest.fn();

  const baseField = {
    id: "test-field",
    label: "Test Label",
    options: [
      { label: "Option A", value: "opt-a" },
      { label: "Option B", value: "opt-b" },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Validation & Null State ---

  it("returns null if options are empty or undefined", () => {
    const fieldNoOptions = { ...baseField, options: [] } as any;
    const { container } = render(
      <DropdownRenderer
        field={fieldNoOptions}
        value=""
        onChange={mockOnChange}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  // --- Section 2: Checkbox Logic ---

  describe("Type: Checkbox", () => {
    const checkboxField = { ...baseField, type: "checkbox" } as any;

    it("renders options as buttons", () => {
      render(
        <DropdownRenderer
          field={checkboxField}
          value={[]}
          onChange={mockOnChange}
        />
      );
      expect(screen.getByText("Option A")).toBeInTheDocument();
      expect(screen.getByText("Option B")).toBeInTheDocument();
    });

    it("adds a value to selection (Toggle On)", () => {
      render(
        <DropdownRenderer
          field={checkboxField}
          value={[]} // Empty initially
          onChange={mockOnChange}
        />
      );
      fireEvent.click(screen.getByText("Option A"));
      expect(mockOnChange).toHaveBeenCalledWith(["opt-a"]);
    });

    it("removes a value from selection (Toggle Off)", () => {
      render(
        <DropdownRenderer
          field={checkboxField}
          value={["opt-a", "opt-b"]} // Already selected
          onChange={mockOnChange}
        />
      );
      fireEvent.click(screen.getByText("Option A"));
      // Should remove 'opt-a' and keep 'opt-b'
      expect(mockOnChange).toHaveBeenCalledWith(["opt-b"]);
    });

    it("handles legacy string value input gracefully (converts to array)", () => {
      render(
        <DropdownRenderer
          field={checkboxField}
          value="opt-a" // Passing string instead of array
          onChange={mockOnChange}
        />
      );
      // Clicking it should toggle it OFF (remove from array)
      fireEvent.click(screen.getByText("Option A"));
      expect(mockOnChange).toHaveBeenCalledWith([]);
    });

    it("applies active styles to selected items", () => {
      render(
        <DropdownRenderer
          field={checkboxField}
          value={["opt-a"]}
          onChange={mockOnChange}
        />
      );
      const btnA = screen.getByText("Option A");
      const btnB = screen.getByText("Option B");

      expect(btnA).toHaveClass("bg-blue-light"); // Active
      expect(btnB).toHaveClass("border-grey-light"); // Inactive
    });

    it("does not trigger change when ReadOnly", () => {
      render(
        <DropdownRenderer
          field={checkboxField}
          value={[]}
          onChange={mockOnChange}
          readOnly={true}
        />
      );
      const btnA = screen.getByText("Option A");
      expect(btnA).toBeDisabled();

      fireEvent.click(btnA);
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  // --- Section 3: Radio Logic ---

  describe("Type: Radio", () => {
    const radioField = { ...baseField, type: "radio" } as any;

    it("renders options as buttons", () => {
      render(
        <DropdownRenderer field={radioField} value="" onChange={mockOnChange} />
      );
      expect(screen.getByText("Option A")).toBeInTheDocument();
    });

    it("calls onChange with selected value", () => {
      render(
        <DropdownRenderer field={radioField} value="" onChange={mockOnChange} />
      );
      fireEvent.click(screen.getByText("Option A"));
      expect(mockOnChange).toHaveBeenCalledWith("opt-a");
    });

    it("applies active styles", () => {
      render(
        <DropdownRenderer
          field={radioField}
          value="opt-a"
          onChange={mockOnChange}
        />
      );
      expect(screen.getByText("Option A")).toHaveClass("bg-blue-light");
      expect(screen.getByText("Option B")).not.toHaveClass("bg-blue-light");
    });

    it("prevents interaction when ReadOnly", () => {
      render(
        <DropdownRenderer
          field={radioField}
          value=""
          onChange={mockOnChange}
          readOnly={true}
        />
      );
      const btn = screen.getByText("Option A");
      expect(btn).toBeDisabled();
      fireEvent.click(btn);
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  // --- Section 4: Dropdown (Default) Logic ---

  describe("Type: Dropdown (Default)", () => {
    const dropdownField = { ...baseField, type: "dropdown" } as any;

    it("renders the mocked Dropdown component", () => {
      render(
        <DropdownRenderer
          field={dropdownField}
          value="opt-a"
          onChange={mockOnChange}
        />
      );
      expect(screen.getByTestId("mock-dropdown")).toBeInTheDocument();
      expect(screen.getByTestId("dropdown-value")).toHaveTextContent('"opt-a"');
      expect(screen.getByTestId("dropdown-placeholder")).toHaveTextContent(
        "Test Label"
      );
    });

    it("calls onChange when an option is selected via mock", () => {
      render(
        <DropdownRenderer
          field={dropdownField}
          value=""
          onChange={mockOnChange}
        />
      );
      fireEvent.click(screen.getByTestId("option-opt-b"));
      expect(mockOnChange).toHaveBeenCalledWith("opt-b");
    });

    it("passes disabled prop when ReadOnly", () => {
      render(
        <DropdownRenderer
          field={dropdownField}
          value=""
          onChange={mockOnChange}
          readOnly={true}
        />
      );
      expect(screen.getByTestId("dropdown-disabled")).toHaveTextContent("true");

      // Attempt click
      fireEvent.click(screen.getByTestId("option-opt-a"));
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  // --- Section 5: Meta & Default Values ---

  it("uses defaultValue if value is undefined", () => {
    const fieldWithDefault = {
      ...baseField,
      type: "dropdown",
      defaultValue: "opt-b",
    } as any;

    render(
      <DropdownRenderer
        field={fieldWithDefault}
        value={undefined} // Simulate initial state
        onChange={mockOnChange}
      />
    );
    expect(screen.getByTestId("dropdown-value")).toHaveTextContent('"opt-b"');
  });

  it("respects field.meta.readonly", () => {
    const fieldReadOnly = {
      ...baseField,
      type: "dropdown",
      meta: { readonly: true },
    } as any;

    render(
      <DropdownRenderer
        field={fieldReadOnly}
        value=""
        onChange={mockOnChange}
      />
    );
    expect(screen.getByTestId("dropdown-disabled")).toHaveTextContent("true");
  });
});
