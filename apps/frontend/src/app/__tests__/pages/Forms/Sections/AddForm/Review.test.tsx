import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import Review from "@/app/pages/Forms/Sections/AddForm/Review";
import { FormsProps, FormField } from "@/app/types/forms";

// --- Mocks ---

// Mock Accordion components
jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid={`accordion-${title}`}>{children}</div>
  ),
}));

jest.mock("@/app/components/Accordion/EditableAccordion", () => ({
  __esModule: true,
  default: ({ title, data }: any) => (
    <div data-testid={`editable-accordion-${title}`}>Data: {data.name}</div>
  ),
}));

// Mock Buttons
jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button data-testid="primary-btn" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick, isDisabled }: any) => (
    <button data-testid="secondary-btn" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
}));

// Mock FormRenderer to test value passing and change handling
jest.mock("@/app/pages/Forms/Sections/AddForm/components/FormRenderer", () => ({
  __esModule: true,
  default: ({ values, onChange }: any) => (
    <div data-testid="form-renderer">
      <span data-testid="renderer-values">{JSON.stringify(values)}</span>
      <button
        data-testid="trigger-change"
        onClick={() => onChange("test_text", "updated value")}
      >
        Trigger Change
      </button>
    </div>
  ),
}));

describe("Review Component", () => {
  const mockOnPublish = jest.fn();
  const mockOnSaveDraft = jest.fn();
  const serviceOptions = [{ label: "Service A", value: "A" }];

  const baseFormData: FormsProps = {
    _id: "form1",
    name: "Test Form",
    category: "Consent form",
    description: "Desc",
    usage: "Internal",
    services: [],
    species: [],
    schema: [],
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering & Initial State Generation ---

  it("renders basic structure correctly", () => {
    render(
      <Review
        formData={baseFormData}
        onPublish={mockOnPublish}
        onSaveDraft={mockOnSaveDraft}
        serviceOptions={serviceOptions}
      />
    );

    expect(
      screen.getByTestId("editable-accordion-Form details")
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("editable-accordion-Usage & visibility")
    ).toBeInTheDocument();

    // Schema is empty, so Form Accordion/Renderer should NOT show
    expect(screen.queryByTestId("accordion-Form")).not.toBeInTheDocument();

    // Check default button texts
    expect(screen.getByTestId("primary-btn")).toHaveTextContent(
      "Publish template"
    );
    expect(screen.getByTestId("secondary-btn")).toHaveTextContent(
      "Save as draft"
    );
  });

  it("generates correct initial values from complex schema (buildInitialValues coverage)", () => {
    const complexSchema: FormField[] = [
      { id: "test_text", type: "text", placeholder: "Enter text" } as any,
      { id: "test_number", type: "number" } as any,
      { id: "test_date", type: "date" } as any,
      { id: "test_bool", type: "boolean" } as any,
      { id: "test_check", type: "checkbox" } as any,
      { id: "test_default", type: "text" } as any, // Missing placeholder branch
      {
        id: "group_1",
        type: "group",
        fields: [
          { id: "nested_text", type: "text", placeholder: "Nested" } as any,
        ],
      } as any,
    ];

    const formDataWithSchema = { ...baseFormData, schema: complexSchema };

    render(
      <Review
        formData={formDataWithSchema}
        onPublish={mockOnPublish}
        onSaveDraft={mockOnSaveDraft}
        serviceOptions={serviceOptions}
      />
    );

    expect(screen.getByTestId("accordion-Form")).toBeInTheDocument();

    const valuesEl = screen.getByTestId("renderer-values");
    const values = JSON.parse(valuesEl.textContent || "{}");

    // Verify all types initialized correctly according to buildInitialValues
    expect(values["test_text"]).toBe("Enter text");
    expect(values["test_number"]).toBe("");
    expect(values["test_date"]).toBe("");
    expect(values["test_bool"]).toBe(false);
    expect(values["test_check"]).toEqual([]);
    expect(values["test_default"]).toBe(""); // Placeholder undefined fallback
    expect(values["nested_text"]).toBe("Nested"); // Recursion check
    expect(values["group_1"]).toBeUndefined(); // Groups themselves store no value
  });

  // --- 2. Interactions & State Updates ---

  it("handles button clicks", () => {
    render(
      <Review
        formData={baseFormData}
        onPublish={mockOnPublish}
        onSaveDraft={mockOnSaveDraft}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByTestId("primary-btn"));
    expect(mockOnPublish).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("secondary-btn"));
    expect(mockOnSaveDraft).toHaveBeenCalled();
  });

  it("updates local state when FormRenderer triggers onChange", () => {
    const schema = [
      { id: "test_text", type: "text", placeholder: "Initial" },
    ] as any;
    const formData = { ...baseFormData, schema };

    render(
      <Review
        formData={formData}
        onPublish={mockOnPublish}
        onSaveDraft={mockOnSaveDraft}
        serviceOptions={serviceOptions}
      />
    );

    const valuesEl = screen.getByTestId("renderer-values");
    // Initial State
    expect(JSON.parse(valuesEl.textContent!)).toEqual({ test_text: "Initial" });

    // Trigger Change (Mock simulates changing "test_text" to "updated value")
    fireEvent.click(screen.getByTestId("trigger-change"));

    // Verify Update
    expect(JSON.parse(valuesEl.textContent!)).toEqual({
      test_text: "updated value",
    });
  });

  // --- 3. Effects ---

  it("resets values when formData schema changes", () => {
    const schema1 = [{ id: "field1", type: "text", placeholder: "A" }] as any;
    const schema2 = [{ id: "field1", type: "text", placeholder: "B" }] as any;

    const { rerender } = render(
      <Review
        formData={{ ...baseFormData, schema: schema1 }}
        onPublish={mockOnPublish}
        onSaveDraft={mockOnSaveDraft}
        serviceOptions={serviceOptions}
      />
    );

    expect(screen.getByTestId("renderer-values")).toHaveTextContent("A");

    // Re-render with new schema
    rerender(
      <Review
        formData={{ ...baseFormData, schema: schema2 }}
        onPublish={mockOnPublish}
        onSaveDraft={mockOnSaveDraft}
        serviceOptions={serviceOptions}
      />
    );

    expect(screen.getByTestId("renderer-values")).toHaveTextContent("B");
  });

  // --- 4. Props Variations (Edit Mode & Loading) ---

  it("renders correctly in Edit mode", () => {
    render(
      <Review
        formData={baseFormData}
        onPublish={mockOnPublish}
        onSaveDraft={mockOnSaveDraft}
        serviceOptions={serviceOptions}
        isEditing={true}
      />
    );

    expect(screen.getByTestId("primary-btn")).toHaveTextContent(
      "Update & publish"
    );
    expect(screen.getByTestId("secondary-btn")).toHaveTextContent(
      "Update draft"
    );
  });

  it("disables buttons when loading", () => {
    render(
      <Review
        formData={baseFormData}
        onPublish={mockOnPublish}
        onSaveDraft={mockOnSaveDraft}
        serviceOptions={serviceOptions}
        loading={true}
      />
    );

    expect(screen.getByTestId("primary-btn")).toBeDisabled();
    expect(screen.getByTestId("secondary-btn")).toBeDisabled();
  });
});
