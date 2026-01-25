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
            onClick={() => !disabled && onChange(o.value)}
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

    it("renders options as checkboxes with labels", () => {
      render(
        <DropdownRenderer
          field={checkboxField}
          value={[]}
          onChange={mockOnChange}
        />
      );
      expect(screen.getByText("Option A")).toBeInTheDocument();
      expect(screen.getByText("Option B")).toBeInTheDocument();
      // Verify actual checkbox inputs exist
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(2);
    });

    it("adds a value to selection (Toggle On)", () => {
      render(
        <DropdownRenderer
          field={checkboxField}
          value={[]} // Empty initially
          onChange={mockOnChange}
        />
      );
      const checkboxA = screen.getAllByRole("checkbox")[0];
      fireEvent.click(checkboxA);
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
      const checkboxA = screen.getAllByRole("checkbox")[0];
      fireEvent.click(checkboxA);
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
      const checkboxA = screen.getAllByRole("checkbox")[0];
      fireEvent.click(checkboxA);
      expect(mockOnChange).toHaveBeenCalledWith([]);
    });

    it("checks selected items", () => {
      render(
        <DropdownRenderer
          field={checkboxField}
          value={["opt-a"]}
          onChange={mockOnChange}
        />
      );
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes[0]).toBeChecked(); // opt-a is checked
      expect(checkboxes[1]).not.toBeChecked(); // opt-b is not checked
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
      const checkboxA = screen.getAllByRole("checkbox")[0];
      expect(checkboxA).toBeDisabled();

      fireEvent.click(checkboxA);
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  // --- Section 3: Radio Logic ---

  describe("Type: Radio", () => {
    const radioField = { ...baseField, type: "radio" } as any;

    it("renders options as radio buttons", () => {
      render(
        <DropdownRenderer field={radioField} value="" onChange={mockOnChange} />
      );
      expect(screen.getByText("Option A")).toBeInTheDocument();
      const radios = screen.getAllByRole("radio");
      expect(radios).toHaveLength(2);
    });

    it("calls onChange with selected value", () => {
      render(
        <DropdownRenderer field={radioField} value="" onChange={mockOnChange} />
      );
      const radioA = screen.getAllByRole("radio")[0];
      fireEvent.click(radioA);
      expect(mockOnChange).toHaveBeenCalledWith("opt-a");
    });

    it("checks selected radio option", () => {
      render(
        <DropdownRenderer
          field={radioField}
          value="opt-a"
          onChange={mockOnChange}
        />
      );
      const radios = screen.getAllByRole("radio");
      expect(radios[0]).toBeChecked(); // opt-a is checked
      expect(radios[1]).not.toBeChecked(); // opt-b is not checked
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
      const radio = screen.getAllByRole("radio")[0];
      expect(radio).toBeDisabled();
      fireEvent.click(radio);
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

      // Attempt click - mock now respects disabled
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
