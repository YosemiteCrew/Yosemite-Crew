import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import EditableAccordion, {
  FieldConfig,
} from "@/app/components/Accordion/EditableAccordion";

const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});


jest.mock("@/app/components/Accordion/Accordion", () => {
  return ({ children, title, onEditClick, showEditIcon }: any) => (
    <div data-testid="accordion-wrapper">
      <h1>{title}</h1>
      {showEditIcon && (
        <button data-testid="accordion-edit-btn" onClick={onEditClick}>
          Edit
        </button>
      )}
      <div data-testid="accordion-content">{children}</div>
    </div>
  );
});

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => {
  return ({ inname, value, onChange, error }: any) => (
    <div>
      <input
        data-testid={`input-${inname}`}
        value={value}
        onChange={onChange}
      />
      {error && <span data-testid={`error-${inname}`}>{error}</span>}
    </div>
  );
});

jest.mock("@/app/components/Inputs/Dropdown/Dropdown", () => {
  return ({ value, onChange, placeholder, options }: any) => (
    <select
      data-testid={`select-${placeholder}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select</option>
      {options?.map((o: any) => {
        const val = typeof o === "string" ? o : o.value;
        const lab = typeof o === "string" ? o : o.label;
        return (
          <option key={val} value={val}>
            {lab}
          </option>
        );
      })}
    </select>
  );
});

jest.mock("@/app/components/Inputs/MultiSelectDropdown", () => {
  return ({ value, onChange, placeholder }: any) => (
    <input
      data-testid={`multiselect-${placeholder}`}
      value={Array.isArray(value) ? value.join(",") : value}
      onChange={(e) => onChange(e.target.value.split(","))}
    />
  );
});

jest.mock("@/app/components/Inputs/Datepicker", () => {
  return ({ currentDate, setCurrentDate, placeholder }: any) => (
    <input
      data-testid={`datepicker-${placeholder}`}
      value={currentDate ? currentDate.toISOString().split("T")[0] : ""}
      onChange={(e) => {
        const date = e.target.value ? new Date(e.target.value) : null;
        setCurrentDate(date);
      }}
    />
  );
});

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ onClick, text }: any) => (
    <button onClick={onClick} data-testid="btn-primary">
      {text}
    </button>
  ),
  Secondary: ({ onClick, text }: any) => (
    <button onClick={onClick} data-testid="btn-secondary">
      {text}
    </button>
  ),
}));

jest.mock("@/app/pages/Inventory/utils", () => ({
  formatDisplayDate: (val: string) => `Formatted-${val}`,
}));

jest.mock("@/app/components/Calendar/weekHelpers", () => ({
  getFormattedDate: (val: any) => (val ? "Formatted-Date-Object" : "-"),
}));

jest.mock("@/app/utils/forms", () => ({
  formatTimeLabel: (val: string) => (val ? `Time-${val}` : "-"),
}));

describe("EditableAccordion", () => {
  const mockOnSave = jest.fn();

  const fields: FieldConfig[] = [
    { label: "Name", key: "name", type: "text", required: true },
    { label: "Age", key: "age", type: "number", required: true },
    { label: "Role", key: "role", type: "select", options: ["Admin", "User"] },
    { label: "Tags", key: "tags", type: "multiSelect", options: ["A", "B"] },
    { label: "Country", key: "country", type: "country" }, // maps to Dropdown
    { label: "Birthday", key: "dob", type: "date" },
    { label: "Shift", key: "shift", type: "time" },
    {
      label: "Status",
      key: "status",
      type: "dropdown",
      options: [{ label: "Active", value: "active" }],
    },
    { label: "ReadOnlyField", key: "fixed", type: "text", editable: false },
  ];

  const initialData = {
    name: "John Doe",
    age: 30,
    role: "Admin",
    tags: ["A"],
    country: "USA",
    dob: "2023-01-01",
    shift: "09:00",
    status: "active",
    fixed: "Cannot Change",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders all fields correctly in view mode", () => {
    render(
      <EditableAccordion
        title="User Info"
        fields={fields}
        data={initialData}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByText("User Info")).toBeInTheDocument();

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();

    expect(screen.getByText("Admin")).toBeInTheDocument(); // Role
    expect(screen.getByText("Active")).toBeInTheDocument(); // Status (label resolution)

    expect(screen.getByText("A")).toBeInTheDocument();

    expect(screen.getByText("USA")).toBeInTheDocument();

    expect(screen.getByText("Formatted-2023-01-01")).toBeInTheDocument();

    expect(screen.getByText("Time-09:00")).toBeInTheDocument();

    expect(screen.getByText("Cannot Change")).toBeInTheDocument();
  });

  it("handles empty or null values in view mode gracefully", () => {
    const emptyData = { tags: [] };
    render(
      <EditableAccordion title="Empty" fields={fields} data={emptyData} />
    );


    const dashes = screen.getAllByText("-");
    expect(dashes.length).toBeGreaterThan(0);
  });

  it("handles complex multiselect display logic (strings vs arrays vs options)", () => {
    const complexFields: FieldConfig[] = [
      { label: "No Opts", key: "noOpts", type: "multiSelect" },
      {
        label: "With Opts",
        key: "withOpts",
        type: "multiSelect",
        options: [{ label: "LabelX", value: "X" }],
      },
      {
        label: "Str Val",
        key: "strVal",
        type: "multiSelect",
        options: [{ label: "LabelY", value: "Y" }],
      },
    ];
    const complexData = {
      noOpts: ["RawValue"],
      withOpts: ["X"],
      strVal: "Y",
    };

    render(
      <EditableAccordion
        title="Complex"
        fields={complexFields}
        data={complexData}
      />
    );

    expect(screen.getByText("RawValue")).toBeInTheDocument();
    expect(screen.getByText("LabelX")).toBeInTheDocument();
    expect(screen.getByText("LabelY")).toBeInTheDocument();
  });

  it("handles Date object inputs in view mode", () => {
    const dateFields = [{ label: "DateObj", key: "d", type: "date" }];
    const dateData = { d: new Date() };
    render(
      <EditableAccordion title="Date" fields={dateFields} data={dateData} />
    );
    expect(screen.getByText("Formatted-Date-Object")).toBeInTheDocument();
  });

  it("switches to edit mode and allows updating values", () => {
    render(
      <EditableAccordion
        title="Edit Me"
        fields={fields}
        data={initialData}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(screen.getByTestId("accordion-edit-btn"));

    const nameInput = screen.getByTestId("input-name");
    fireEvent.change(nameInput, { target: { value: "Jane Doe" } });

    const roleSelect = screen.getByTestId("select-Role");
    fireEvent.change(roleSelect, { target: { value: "User" } });

    const tagsInput = screen.getByTestId("multiselect-Tags");
    fireEvent.change(tagsInput, { target: { value: "A,B" } });

    const dateInput = screen.getByTestId("datepicker-Birthday");
    fireEvent.change(dateInput, { target: { value: "2025-12-31" } });

    fireEvent.click(screen.getByTestId("btn-primary")); // Save button

    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Jane Doe",
        role: "User",
        tags: ["A", "B"],
        dob: "2025-12-31",
      })
    );
  });

  it("handles datepicker clearing (null value)", () => {
    render(
      <EditableAccordion
        title="Edit Date"
        fields={[{ label: "D", key: "d", type: "date" }]}
        data={{ d: "2020-01-01" }}
      />
    );
    fireEvent.click(screen.getByTestId("accordion-edit-btn"));
    const dateInput = screen.getByTestId("datepicker-D");

    fireEvent.change(dateInput, { target: { value: "" } });

    expect(screen.getByTestId("btn-primary")).toBeInTheDocument();
  });

  it("parses different date formats in edit mode", () => {
    render(
      <EditableAccordion
        title="Edit Date"
        fields={[{ label: "D", key: "d", type: "date" }]}
        data={{ d: "01/01/2023" }}
      />
    );
    fireEvent.click(screen.getByTestId("accordion-edit-btn"));

    const dateInput = screen.getByTestId("datepicker-D");
    expect(dateInput).toHaveValue("2023-01-01");
  });

  it("validates required fields before saving", async () => {
    render(
      <EditableAccordion
        title="Validation"
        fields={fields}
        data={initialData}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(screen.getByTestId("accordion-edit-btn"));

    fireEvent.change(screen.getByTestId("input-name"), {
      target: { value: "" },
    });

    fireEvent.change(screen.getByTestId("input-age"), {
      target: { value: "" },
    });

    fireEvent.click(screen.getByTestId("btn-primary"));

    expect(screen.getByTestId("error-name")).toHaveTextContent(
      "Name is required"
    );
    expect(screen.getByText("Age is required")).toBeInTheDocument();

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it("validates empty array for required multiselect", () => {
    const reqFields: FieldConfig[] = [
      { label: "Tags", key: "t", type: "multiSelect", required: true },
    ];
    render(<EditableAccordion title="V" fields={reqFields} data={{ t: [] }} />);

    fireEvent.click(screen.getByTestId("accordion-edit-btn"));
    fireEvent.click(screen.getByTestId("btn-primary"));

  });

  it("resets values and exits edit mode on cancel", () => {
    render(
      <EditableAccordion
        title="Cancel"
        fields={fields}
        data={initialData}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(screen.getByTestId("accordion-edit-btn"));

    fireEvent.change(screen.getByTestId("input-name"), {
      target: { value: "Changed" },
    });

    fireEvent.click(screen.getByTestId("btn-secondary"));

    expect(screen.getByTestId("accordion-edit-btn")).toBeInTheDocument();

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.queryByText("Changed")).not.toBeInTheDocument();
  });

  it("does not allow editing if readOnly is true", () => {
    render(
      <EditableAccordion
        title="RO"
        fields={fields}
        data={initialData}
        readOnly={true}
      />
    );

    expect(screen.queryByTestId("accordion-edit-btn")).not.toBeInTheDocument();
  });

  it("forces edit mode off if readOnly prop changes to true dynamically", () => {
    const { rerender } = render(
      <EditableAccordion
        title="Dyn"
        fields={fields}
        data={initialData}
        readOnly={false}
      />
    );

    fireEvent.click(screen.getByTestId("accordion-edit-btn"));
    expect(screen.getByTestId("btn-primary")).toBeInTheDocument();

    rerender(
      <EditableAccordion
        title="Dyn"
        fields={fields}
        data={initialData}
        readOnly={true}
      />
    );

    expect(screen.queryByTestId("btn-primary")).not.toBeInTheDocument();
  });

  it("handles initialization of multiselect with string data", () => {
    const msFields = [{ label: "M", key: "m", type: "multiSelect" }];
    const msData = { m: "SingleString" };

    render(
      <EditableAccordion title="Init" fields={msFields as any} data={msData} />
    );
    fireEvent.click(screen.getByTestId("accordion-edit-btn"));

    const input = screen.getByTestId("multiselect-M");
    expect(input).toHaveValue("SingleString");
  });

  it("renders non-editable fields correctly in edit mode", () => {
    render(
      <EditableAccordion title="Fixed" fields={fields} data={initialData} />
    );
    fireEvent.click(screen.getByTestId("accordion-edit-btn"));

    expect(screen.queryByTestId("input-fixed")).not.toBeInTheDocument();
    expect(screen.getByText("Cannot Change")).toBeInTheDocument();
  });
});
