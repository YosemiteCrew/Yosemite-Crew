import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import FormRenderer from "@/app/pages/Forms/Sections/AddForm/components/FormRenderer";

// --- Mocks for Child Components ---
// Logic is INLINED to avoid hoisting ReferenceErrors.

jest.mock(
  "@/app/pages/Forms/Sections/AddForm/components/Dropdown/DropdownRenderer",
  () => ({
    __esModule: true,
    default: ({ value, onChange, readOnly }: any) => (
      <div data-testid="mock-dropdown">
        <span data-testid="value-dropdown">{JSON.stringify(value)}</span>
        <span data-testid="readonly-dropdown">{String(readOnly)}</span>
        <input
          data-testid="input-dropdown"
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    ),
  })
);

jest.mock(
  "@/app/pages/Forms/Sections/AddForm/components/Input/InputRenderer",
  () => ({
    __esModule: true,
    default: ({ value, onChange, readOnly }: any) => (
      <div data-testid="mock-input">
        <span data-testid="value-input">{JSON.stringify(value)}</span>
        <span data-testid="readonly-input">{String(readOnly)}</span>
        <input
          data-testid="input-input"
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    ),
  })
);

jest.mock(
  "@/app/pages/Forms/Sections/AddForm/components/Signature/SignatureRenderer",
  () => ({
    __esModule: true,
    default: ({ value, onChange, readOnly }: any) => (
      <div data-testid="mock-signature">
        <span data-testid="value-signature">{JSON.stringify(value)}</span>
        <span data-testid="readonly-signature">{String(readOnly)}</span>
        <input
          data-testid="input-signature"
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    ),
  })
);

jest.mock(
  "@/app/pages/Forms/Sections/AddForm/components/Text/TextRenderer",
  () => ({
    __esModule: true,
    default: ({ value, onChange, readOnly }: any) => (
      <div data-testid="mock-textarea">
        <span data-testid="value-textarea">{JSON.stringify(value)}</span>
        <span data-testid="readonly-textarea">{String(readOnly)}</span>
        <input
          data-testid="input-textarea"
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    ),
  })
);

jest.mock(
  "@/app/pages/Forms/Sections/AddForm/components/Boolean/BooleanRenderer",
  () => ({
    __esModule: true,
    default: ({ value, onChange, readOnly }: any) => (
      <div data-testid="mock-boolean">
        <span data-testid="value-boolean">{JSON.stringify(value)}</span>
        <span data-testid="readonly-boolean">{String(readOnly)}</span>
        <input
          data-testid="input-boolean"
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    ),
  })
);

jest.mock(
  "@/app/pages/Forms/Sections/AddForm/components/Date/DateRenderer",
  () => ({
    __esModule: true,
    default: ({ value, onChange, readOnly }: any) => (
      <div data-testid="mock-date">
        <span data-testid="value-date">{JSON.stringify(value)}</span>
        <span data-testid="readonly-date">{String(readOnly)}</span>
        <input
          data-testid="input-date"
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    ),
  })
);

describe("FormRenderer Component", () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Rendering & Value Resolution ---

  it("renders correct components based on field type", () => {
    // Cast to 'any' to bypass strict FormField requirement for test mocks
    const fields: any[] = [
      { id: "f1", type: "input", label: "Input Field" },
      { id: "f2", type: "textarea", label: "Text Area" },
    ];

    render(
      <FormRenderer fields={fields} values={{}} onChange={mockOnChange} />
    );

    expect(screen.getByTestId("mock-input")).toBeInTheDocument();
    expect(screen.getByTestId("mock-textarea")).toBeInTheDocument();
  });

  it("prioritizes existing value over defaultValue and fallback", () => {
    const fields: any[] = [
      {
        id: "f1",
        type: "input",
        label: "F1",
        defaultValue: "Default",
        placeholder: "Placeholder",
      },
    ];
    const values = { f1: "Existing Value" };

    render(
      <FormRenderer fields={fields} values={values} onChange={mockOnChange} />
    );

    expect(screen.getByTestId("value-input")).toHaveTextContent(
      '"Existing Value"'
    );
  });

  it("uses defaultValue if existing value is missing", () => {
    const fields: any[] = [
      {
        id: "f1",
        type: "input",
        label: "F1",
        defaultValue: "Default Value",
        placeholder: "Placeholder",
      },
    ];

    render(
      <FormRenderer fields={fields} values={{}} onChange={mockOnChange} />
    );

    expect(screen.getByTestId("value-input")).toHaveTextContent(
      '"Default Value"'
    );
  });

  it("uses fallback value if existing and default values are missing", () => {
    const fields: any[] = [
      {
        id: "f1",
        type: "input",
        label: "F1",
        placeholder: "Fallback Placeholder",
      },
    ];

    render(
      <FormRenderer fields={fields} values={{}} onChange={mockOnChange} />
    );

    // Logic: field.placeholder || ""
    expect(screen.getByTestId("value-input")).toHaveTextContent(
      '"Fallback Placeholder"'
    );
  });

  // --- Section 2: Group Rendering (Recursion) ---

  it("renders groups recursively with correct structure", () => {
    const fields: any[] = [
      {
        id: "g1",
        type: "group",
        label: "My Group",
        fields: [{ id: "n1", type: "input", label: "Nested Input" }],
      },
    ];
    const values = { n1: "Nested Value" };

    render(
      <FormRenderer fields={fields} values={values} onChange={mockOnChange} />
    );

    // Verify Group Label
    expect(screen.getByText("My Group")).toBeInTheDocument();

    // Verify Nested Field is rendered
    expect(screen.getByTestId("mock-input")).toBeInTheDocument();
    expect(screen.getByTestId("value-input")).toHaveTextContent(
      '"Nested Value"'
    );
  });

  it("renders default group label if label is missing", () => {
    const fields: any[] = [
      { id: "g1", type: "group", fields: [] }, // No label provided
    ];

    render(
      <FormRenderer fields={fields} values={{}} onChange={mockOnChange} />
    );

    // Falls back to humanized id when label is absent
    expect(screen.getByText("G1")).toBeInTheDocument();
  });

  // --- Section 3: Interactions (onChange) ---

  it("calls onChange with correct id and value when field updates", () => {
    const fields: any[] = [{ id: "f1", type: "input", label: "F1" }];

    render(
      <FormRenderer fields={fields} values={{}} onChange={mockOnChange} />
    );

    const input = screen.getByTestId("input-input");
    fireEvent.change(input, { target: { value: "New Value" } });

    expect(mockOnChange).toHaveBeenCalledWith("f1", "New Value");
  });

  it("propagates readOnly prop to children", () => {
    const fields: any[] = [{ id: "f1", type: "input", label: "F1" }];

    render(
      <FormRenderer
        fields={fields}
        values={{}}
        onChange={mockOnChange}
        readOnly={true}
      />
    );

    expect(screen.getByTestId("readonly-input")).toHaveTextContent("true");
  });

  // --- Section 4: Fallback Value Logic (Coverage for `getFallbackValue`) ---

  it("returns correct fallback for 'checkbox' type", () => {
    const fields: any[] = [{ id: "c1", type: "checkbox", label: "C1" }];
    render(
      <FormRenderer fields={fields} values={{}} onChange={mockOnChange} />
    );
    // Checkbox uses DropdownRenderer mock in the code map
    expect(screen.getByTestId("value-dropdown")).toHaveTextContent("[]");
  });

  it("returns correct fallback for 'boolean' type", () => {
    const fields: any[] = [{ id: "b1", type: "boolean", label: "B1" }];
    render(
      <FormRenderer fields={fields} values={{}} onChange={mockOnChange} />
    );
    expect(screen.getByTestId("value-boolean")).toHaveTextContent("false");
  });

  it("returns correct fallback for 'number' type", () => {
    const fields: any[] = [{ id: "n1", type: "number", label: "N1" }];
    render(
      <FormRenderer fields={fields} values={{}} onChange={mockOnChange} />
    );
    // Number uses InputRenderer mock
    expect(screen.getByTestId("value-input")).toHaveTextContent('""');
  });

  it("returns correct fallback for 'date' type", () => {
    const fields: any[] = [{ id: "d1", type: "date", label: "D1" }];
    render(
      <FormRenderer fields={fields} values={{}} onChange={mockOnChange} />
    );
    expect(screen.getByTestId("value-date")).toHaveTextContent('""');
  });

  it("returns placeholder as fallback for 'textarea'/'input'", () => {
    const fields: any[] = [
      { id: "t1", type: "textarea", label: "T1", placeholder: "Enter text" },
      { id: "i1", type: "input", label: "I1", placeholder: "Enter input" },
    ];
    render(
      <FormRenderer fields={fields} values={{}} onChange={mockOnChange} />
    );

    expect(screen.getByTestId("value-textarea")).toHaveTextContent(
      '"Enter text"'
    );
    expect(screen.getAllByTestId("value-input")[0]).toHaveTextContent(
      '"Enter input"'
    );
  });

  it("returns empty string as fallback for 'textarea'/'input' if placeholder missing", () => {
    const fields: any[] = [
      { id: "t1", type: "textarea", label: "T1" }, // No placeholder
    ];
    render(
      <FormRenderer fields={fields} values={{}} onChange={mockOnChange} />
    );
    expect(screen.getByTestId("value-textarea")).toHaveTextContent('""');
  });

  it("returns empty string for unknown/default types (e.g., signature)", () => {
    const fields: any[] = [{ id: "s1", type: "signature", label: "S1" }];
    render(
      <FormRenderer fields={fields} values={{}} onChange={mockOnChange} />
    );
    // Signature falls through to the final return ""
    expect(screen.getByTestId("value-signature")).toHaveTextContent('""');
  });
});
