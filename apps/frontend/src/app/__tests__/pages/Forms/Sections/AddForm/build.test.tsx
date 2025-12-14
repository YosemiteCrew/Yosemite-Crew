import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import Build from "@/app/pages/Forms/Sections/AddForm/Build";
import { FormsProps } from "@/app/types/forms";

// --- Mocks ---

// Mock crypto.randomUUID
Object.defineProperty(globalThis, "crypto", {
  value: {
    randomUUID: () => "new-uuid-" + Math.random().toString(36),
  },
});

// Mock Icons
jest.mock("react-icons/io", () => ({
  IoIosAddCircleOutline: ({ onClick }: any) => (
    <button type="button" data-testid="add-field-btn" onClick={onClick}>
      Add Field
    </button>
  ),
}));

// Mock Buttons
jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" data-testid="next-btn" onClick={onClick}>
      {text}
    </button>
  ),
}));

// Mock Common Inputs
jest.mock("@/app/components/Inputs/FormInput/FormInput", () => {
  return ({ inlabel, value, onChange }: any) => (
    <div data-testid="mock-form-input">
      <label>{inlabel}</label>
      <input
        data-testid={`input-${inlabel}`}
        value={value}
        onChange={onChange}
      />
    </div>
  );
});

jest.mock("@/app/components/Inputs/MultiSelectDropdown", () => {
  return ({ placeholder, value, onChange }: any) => (
    <div data-testid="mock-multiselect">
      <label>{placeholder}</label>
      <input
        data-testid="multiselect-input"
        value={Array.isArray(value) ? value.join(",") : ""}
        onChange={(e) => onChange(e.target.value.split(",").filter(Boolean))}
      />
    </div>
  );
});

// --- Mock Builder Components ---

jest.mock(
  "@/app/pages/Forms/Sections/AddForm/components/Text/TextBuilder",
  () => {
    return ({ field, onChange }: any) => (
      <div data-testid={`builder-${field.type}-${field.id}`}>
        <input
          data-testid={`edit-${field.id}`}
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
        />
      </div>
    );
  }
);

jest.mock(
  "@/app/pages/Forms/Sections/AddForm/components/Input/InputBuilder",
  () => {
    return ({ field, onChange }: any) => (
      <div data-testid={`builder-${field.type}-${field.id}`}>
        <input
          data-testid={`edit-${field.id}`}
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
        />
      </div>
    );
  }
);

jest.mock(
  "@/app/pages/Forms/Sections/AddForm/components/Dropdown/DropdownBuilder",
  () => {
    return ({ field, onChange }: any) => (
      <div data-testid={`builder-${field.type}-${field.id}`}>
        <input
          data-testid={`edit-${field.id}`}
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
        />
      </div>
    );
  }
);

jest.mock(
  "@/app/pages/Forms/Sections/AddForm/components/Signature/SignatureBuilder",
  () => {
    return ({ field, onChange }: any) => (
      <div data-testid={`builder-${field.type}-${field.id}`}>
        <input
          data-testid={`edit-${field.id}`}
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
        />
      </div>
    );
  }
);

jest.mock(
  "@/app/pages/Forms/Sections/AddForm/components/Boolean/BooleanBuilder",
  () => {
    return ({ field, onChange }: any) => (
      <div data-testid={`builder-${field.type}-${field.id}`}>
        <input
          data-testid={`edit-${field.id}`}
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
        />
      </div>
    );
  }
);

jest.mock(
  "@/app/pages/Forms/Sections/AddForm/components/Date/DateBuilder",
  () => {
    return ({ field, onChange }: any) => (
      <div data-testid={`builder-${field.type}-${field.id}`}>
        <input
          data-testid={`edit-${field.id}`}
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
        />
      </div>
    );
  }
);

// Mock Wrapper
jest.mock("@/app/pages/Forms/Sections/AddForm/components/BuildWrapper", () => {
  return ({ children, onDelete }: any) => (
    <div data-testid="builder-wrapper">
      {children}
      <button type="button" data-testid="delete-btn" onClick={onDelete}>
        Delete
      </button>
    </div>
  );
});

describe("Build Component", () => {
  const mockSetFormData = jest.fn();
  const mockOnNext = jest.fn();
  const mockRegisterValidator = jest.fn();

  const defaultServiceOptions = [
    { label: "Service A", value: "Service A" },
    { label: "Service B", value: "Service B" },
  ];

  // Fix: Added missing properties (category, updatedBy, lastUpdated) to match FormsProps
  const defaultFormData: FormsProps = {
    _id: "form-1",
    name: "Test Form",
    status: "Draft",
    usage: "Internal",
    schema: [],
    // FIX: Changed "General" to "Custom" to match the strict union type
    category: "Custom",
    updatedBy: "test-user-id",
    lastUpdated: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Basic Rendering & Validation ---

  it("renders the Build component with title and Next button", () => {
    render(
      <Build
        formData={defaultFormData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={defaultServiceOptions}
        registerValidator={mockRegisterValidator}
      />
    );

    expect(screen.getByText("Build form")).toBeInTheDocument();
    expect(screen.getAllByTestId("add-field-btn").length).toBeGreaterThan(0);
    expect(screen.getByTestId("next-btn")).toBeInTheDocument();
  });

  it("registers a validator that fails when schema is empty", () => {
    render(
      <Build
        formData={{ ...defaultFormData, schema: [] }}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={defaultServiceOptions}
        registerValidator={mockRegisterValidator}
      />
    );

    expect(mockRegisterValidator).toHaveBeenCalled();
    const validateFn = mockRegisterValidator.mock.calls[0][0];

    act(() => {
      const isValid = validateFn();
      expect(isValid).toBe(false);
    });

    expect(
      screen.getByText("Add at least one field to continue.")
    ).toBeInTheDocument();
  });

  it("registers a validator that passes when schema has fields", () => {
    const formDataWithField = {
      ...defaultFormData,
      schema: [{ id: "1", type: "input", label: "Test Input" } as any],
    };

    render(
      <Build
        formData={formDataWithField}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={defaultServiceOptions}
        registerValidator={mockRegisterValidator}
      />
    );

    const validateFn = mockRegisterValidator.mock.calls[0][0];
    act(() => {
      const isValid = validateFn();
      expect(isValid).toBe(true);
    });

    expect(
      screen.queryByText("Add at least one field to continue.")
    ).not.toBeInTheDocument();
  });

  // --- 2. Add / Edit / Delete Interactions ---

  it("adds a basic field (Input) when selected from dropdown", () => {
    render(
      <Build
        formData={defaultFormData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={defaultServiceOptions}
      />
    );

    const addBtn = screen.getAllByTestId("add-field-btn")[0];
    fireEvent.click(addBtn);

    const inputOptions = screen.getAllByText("Input");
    // Fix: Use .at(-1) instead of length - 1
    fireEvent.click(inputOptions.at(-1)!);

    expect(mockSetFormData).toHaveBeenCalled();
  });

  it("edits a field label via the mock builder", () => {
    const existingSchema = [
      { id: "f1", type: "input", label: "Old Label" } as any,
    ];

    render(
      <Build
        formData={{ ...defaultFormData, schema: existingSchema }}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={defaultServiceOptions}
      />
    );

    const editInput = screen.getByTestId("edit-f1");
    fireEvent.change(editInput, { target: { value: "New Label" } });

    // Fix: Use .at(-1) instead of length - 1
    const updateFn = mockSetFormData.mock.calls.at(-1)![0];
    const newState = updateFn({ ...defaultFormData, schema: existingSchema });

    expect(newState.schema[0].label).toBe("New Label");
  });

  it("deletes a field when delete button is clicked", () => {
    const existingSchema = [
      { id: "f1", type: "input", label: "To Delete" } as any,
    ];

    render(
      <Build
        formData={{ ...defaultFormData, schema: existingSchema }}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={defaultServiceOptions}
      />
    );

    const deleteBtn = screen.getByTestId("delete-btn");
    fireEvent.click(deleteBtn);

    // Fix: Use .at(-1) instead of length - 1
    const updateFn = mockSetFormData.mock.calls.at(-1)![0];
    const newState = updateFn({ ...defaultFormData, schema: existingSchema });

    expect(newState.schema).toHaveLength(0);
  });

  // --- 3. Group & Nested Logic ---

  it("renders a group and allows adding nested fields", () => {
    const groupSchema = [
      { id: "g1", type: "group", label: "My Group", fields: [] } as any,
    ];

    render(
      <Build
        formData={{ ...defaultFormData, schema: groupSchema }}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={defaultServiceOptions}
      />
    );

    const addButtons = screen.getAllByTestId("add-field-btn");
    expect(addButtons.length).toBeGreaterThan(1);

    // Click the SECOND add button (index 1) which belongs to the group
    fireEvent.click(addButtons[1]);

    const inputOptions = screen.getAllByText("Input");
    // Fix: Use .at(-1) instead of length - 1
    fireEvent.click(inputOptions.at(-1)!);

    // Fix: Use .at(-1) instead of length - 1
    const updateFn = mockSetFormData.mock.calls.at(-1)![0];
    const newState = updateFn({ ...defaultFormData, schema: groupSchema });

    expect(newState.schema[0].fields).toHaveLength(1);
    expect(newState.schema[0].fields[0].type).toBe("input");
  });

  it("updates a nested field within a group", () => {
    const nestedField = { id: "n1", type: "input", label: "Nested" };
    const groupSchema = [
      {
        id: "g1",
        type: "group",
        fields: [nestedField],
      } as any,
    ];

    render(
      <Build
        formData={{ ...defaultFormData, schema: groupSchema }}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={defaultServiceOptions}
      />
    );

    const editInput = screen.getByTestId("edit-n1");
    fireEvent.change(editInput, { target: { value: "Updated Nested" } });

    // Fix: Use .at(-1) instead of length - 1
    const updateFn = mockSetFormData.mock.calls.at(-1)![0];
    const newState = updateFn({ ...defaultFormData, schema: groupSchema });

    expect(newState.schema[0].fields[0].label).toBe("Updated Nested");
  });

  it("removes a nested field from a group", () => {
    const nestedField = { id: "n1", type: "input", label: "Nested" };
    const groupSchema = [
      {
        id: "g1",
        type: "group",
        fields: [nestedField],
      } as any,
    ];

    render(
      <Build
        formData={{ ...defaultFormData, schema: groupSchema }}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={defaultServiceOptions}
      />
    );

    const deleteButtons = screen.getAllByTestId("delete-btn");
    fireEvent.click(deleteButtons[1]);

    // Check call, no need to assign unused variable
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it("edits group label", () => {
    const groupSchema = [
      { id: "g1", type: "group", label: "My Group", fields: [] } as any,
    ];

    render(
      <Build
        formData={{ ...defaultFormData, schema: groupSchema }}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={defaultServiceOptions}
      />
    );

    const groupNameInput = screen.getByTestId("input-Group name");
    fireEvent.change(groupNameInput, { target: { value: "New Group Name" } });

    // Fix: Use .at(-1) instead of length - 1
    const updateFn = mockSetFormData.mock.calls.at(-1)![0];
    const newState = updateFn({ ...defaultFormData, schema: groupSchema });
    expect(newState.schema[0].label).toBe("New Group Name");
  });

  // --- 4. Service Group Logic ---

  it("adds a service group and ensures checkbox exists", () => {
    render(
      <Build
        formData={defaultFormData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={defaultServiceOptions}
      />
    );

    const addBtns = screen.getAllByTestId("add-field-btn");
    fireEvent.click(addBtns[0]);

    fireEvent.click(screen.getByText("Service group"));

    // Fix: Use .at(-1) instead of length - 1
    const updateFn = mockSetFormData.mock.calls.at(-1)![0];
    const newState = updateFn(defaultFormData);
    const serviceGroup = newState.schema[0];

    expect(serviceGroup.type).toBe("group");
    expect((serviceGroup as unknown as any).meta?.serviceGroup).toBe(true);

    const checkbox = serviceGroup.fields.find(
      (f: any) => f.type === "checkbox" && f.label === "Services"
    );
    expect(checkbox).toBeDefined();
  });

  it("updates options of service group checkbox when MultiSelect changes", () => {
    const serviceCheckbox = {
      id: "chk-1",
      type: "checkbox",
      label: "Services",
      options: [{ label: "Service A", value: "Service A" }],
    };
    const serviceGroup = {
      id: "sg-1",
      type: "group",
      label: "My Services",
      meta: { serviceGroup: true },
      fields: [serviceCheckbox],
    } as any;

    render(
      <Build
        formData={{ ...defaultFormData, schema: [serviceGroup] }}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={defaultServiceOptions}
      />
    );

    const multiSelect = screen.getByTestId("multiselect-input");
    fireEvent.change(multiSelect, {
      target: { value: "Service A,Service B" },
    });

    // Fix: Use .at(-1) instead of length - 1
    const updateFn = mockSetFormData.mock.calls.at(-1)![0];
    const newState = updateFn({ ...defaultFormData, schema: [serviceGroup] });
    const updatedCheckbox = newState.schema[0].fields[0];

    expect(updatedCheckbox.options).toHaveLength(2);
    expect(updatedCheckbox.options[1].value).toBe("Service B");
  });

  // --- 5. Medication Logic ---

  it("adds a medication group", () => {
    render(
      <Build
        formData={defaultFormData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={defaultServiceOptions}
      />
    );

    const addBtns = screen.getAllByTestId("add-field-btn");
    fireEvent.click(addBtns[0]);

    fireEvent.click(screen.getByText("Medication group"));

    // Fix: Use .at(-1) instead of length - 1
    const updateFn = mockSetFormData.mock.calls.at(-1)![0];
    const newState = updateFn(defaultFormData);
    const medGroup = newState.schema[0];

    expect(medGroup.label).toBe("Medication");
    expect(medGroup.fields.length).toBeGreaterThan(0);
  });

  it("adds medication to existing Treatment Plan group if present", () => {
    const treatmentPlanGroup = {
      id: "treatment_plan",
      type: "group",
      label: "Treatment Plan",
      fields: [],
    } as any;

    render(
      <Build
        formData={{ ...defaultFormData, schema: [treatmentPlanGroup] }}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={defaultServiceOptions}
      />
    );

    const addBtns = screen.getAllByTestId("add-field-btn");
    fireEvent.click(addBtns[0]);

    fireEvent.click(screen.getByText("Medication group"));

    // Fix: Use .at(-1) instead of length - 1
    const updateFn = mockSetFormData.mock.calls.at(-1)![0];
    const newState = updateFn({
      ...defaultFormData,
      schema: [treatmentPlanGroup],
    });

    const updatedTP = newState.schema[0];
    expect(updatedTP.fields).toHaveLength(1);
    expect(updatedTP.fields[0].label).toBe("Medication 1");
  });

  // --- 6. Dropdown Logic (Outside Click) ---

  it("closes the add field dropdown when clicking outside", () => {
    render(
      <Build
        formData={defaultFormData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={defaultServiceOptions}
      />
    );

    const addBtns = screen.getAllByTestId("add-field-btn");
    fireEvent.click(addBtns[0]);
    expect(screen.getByText("Input")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByText("Input")).not.toBeInTheDocument();
  });
});
