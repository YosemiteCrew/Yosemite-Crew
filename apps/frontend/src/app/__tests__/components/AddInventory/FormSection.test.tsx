import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import FormSection from "@/app/components/AddInventory/FormSection";
import { BusinessType } from "@/app/types/org";

// --- Mocks ---
jest.mock("@/app/components/Accordion/Accordion", () => {
  return function MockAccordion({ children, title }: any) {
    return (
      <div data-testid="accordion">
        <h3>{title}</h3>
        {children}
      </div>
    );
  };
});

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ onClick, text, isDisabled }: any) => (
    <button onClick={onClick} disabled={isDisabled} data-testid="btn-primary">
      {text}
    </button>
  ),
  Secondary: ({ onClick, text, isDisabled }: any) => (
    <button onClick={onClick} disabled={isDisabled} data-testid="btn-secondary">
      {text}
    </button>
  ),
}));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => (props: any) => (
  <input
    data-testid={`input-${props.inname}`}
    value={props.value}
    onChange={props.onChange}
    placeholder={props.inlabel}
  />
));

jest.mock("@/app/components/Inputs/Dropdown/Dropdown", () => (props: any) => (
  <select
    data-testid={`dropdown-${props.placeholder}`}
    value={props.value}
    onChange={(e) => props.onChange(e.target.value)}
  >
    <option value="">Select</option>
    {props.options.map((o: any) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
));

jest.mock("@/app/components/Inputs/MultiSelectDropdown", () => (props: any) => (
  <div data-testid={`multiselect-${props.placeholder}`}>
    <span data-testid="ms-value">{JSON.stringify(props.value)}</span>
    <button
      onClick={() => props.onChange(["selected_val"])}
      data-testid="ms-change-btn"
    >
      Change
    </button>
  </div>
));

jest.mock("@/app/components/Inputs/FormDesc/FormDesc", () => (props: any) => (
  <textarea
    data-testid={`textarea-${props.inname}`}
    value={props.value}
    onChange={props.onChange}
  />
));

jest.mock("@/app/components/Inputs/Datepicker", () => {
  return function MockDatepicker({
    currentDate,
    setCurrentDate,
    placeholder,
  }: any) {
    return (
      <div data-testid={`datepicker-${placeholder}`}>
        <span data-testid="date-value">
          {currentDate ? currentDate.toISOString() : "null"}
        </span>
        <button
          onClick={() => {
            const d = new Date("2023-01-01");
            setCurrentDate(d);
          }}
          data-testid="date-set-direct"
        >
          Set Direct
        </button>
        <button
          onClick={() => {
            setCurrentDate((_prev: any) => new Date("2023-02-02"));
          }}
          data-testid="date-set-fn"
        >
          Set Function
        </button>
        <button
          onClick={() => {
            setCurrentDate(null);
          }}
          data-testid="date-set-null"
        >
          Set Null
        </button>
      </div>
    );
  };
});

jest.mock("@/app/components/AddInventory/InventoryConfig", () => ({
  InventoryFormConfig: {
    clinic: {
      basicInfo: [
        {
          kind: "item",
          field: {
            name: "itemName",
            component: "text",
            placeholder: "Item Name",
          },
        },
        {
          kind: "row",
          fields: [
            {
              name: "category",
              component: "dropdown",
              placeholder: "Category",
              options: [
                { label: "A", value: "a" },
                { label: "B", value: "b" },
              ],
            },
            { name: "description", component: "textarea", placeholder: "Desc" },
          ],
        },
        {
          kind: "item",
          field: { name: "expiry", component: "date", placeholder: "Expiry" },
        },
        {
          kind: "item",
          field: {
            name: "tags",
            component: "multiSelect",
            placeholder: "Tags",
          },
        },
        { kind: "item", field: { name: "unknown", component: "unknown" } },
      ],
      emptySection: [],
      batch: [
        {
          kind: "item",
          field: {
            name: "batchNumber",
            component: "text",
            placeholder: "Batch No",
          },
        },
      ],
    },
  },
}));

describe("FormSection Component", () => {
  const mockOnFieldChange = jest.fn();
  const mockOnSave = jest.fn();
  const mockOnClear = jest.fn();
  const mockOnAddBatch = jest.fn();
  const mockOnRemoveBatch = jest.fn();

  const defaultProps = {
    businessType: "clinic" as BusinessType,
    sectionKey: "basicInfo" as any,
    sectionTitle: "Basic Information",
    formData: {
      basicInfo: {
        itemName: "Test Item",
        category: "a",
        description: "Test Desc",
        expiry: "2023-12-31",
        tags: ["tag1"],
      },
      batches: [],
    } as any,
    errors: { basicInfo: { itemName: "Name required" } } as any,
    onFieldChange: mockOnFieldChange,
    onSave: mockOnSave,
    onClear: mockOnClear,
    onAddBatch: mockOnAddBatch,
    onRemoveBatch: mockOnRemoveBatch,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders 'No fields configured' if config is missing or empty", () => {
    render(
      <FormSection {...defaultProps} sectionKey={"emptySection" as any} />
    );
    expect(screen.getByText("No fields configured.")).toBeInTheDocument();
  });

  it("renders standard fields correctly (Text, Dropdown, Textarea, Row Layout)", () => {
    render(<FormSection {...defaultProps} />);

    // To handle multiple elements with same text (title inside Accordion + Header), we use getAllByText
    const titles = screen.getAllByText("Basic Information");
    expect(titles.length).toBeGreaterThan(0);

    // Text Input
    const input = screen.getByTestId("input-itemName");
    expect(input).toHaveValue("Test Item");

    fireEvent.change(input, { target: { value: "New Name" } });
    expect(mockOnFieldChange).toHaveBeenLastCalledWith(
      "basicInfo",
      "itemName",
      "New Name",
      undefined
    );

    // Dropdown (inside Row)
    const dropdown = screen.getByTestId("dropdown-Category");
    expect(dropdown).toHaveValue("a");

    fireEvent.change(dropdown, { target: { value: "b" } });
    expect(mockOnFieldChange).toHaveBeenLastCalledWith(
      "basicInfo",
      "category",
      "b",
      undefined
    );

    // Textarea (inside Row)
    const textarea = screen.getByTestId("textarea-description");
    expect(textarea).toHaveValue("Test Desc");
  });

  it("handles Date parsing and changes correctly", () => {
    render(<FormSection {...defaultProps} />);
    const dateValue = screen.getByTestId("date-value");
    expect(dateValue).toHaveTextContent("2023-12-31");

    fireEvent.click(screen.getByTestId("date-set-direct"));
    expect(mockOnFieldChange).toHaveBeenLastCalledWith(
      "basicInfo",
      "expiry",
      "2023-01-01",
      undefined
    );

    fireEvent.click(screen.getByTestId("date-set-fn"));
    expect(mockOnFieldChange).toHaveBeenLastCalledWith(
      "basicInfo",
      "expiry",
      "2023-02-02",
      undefined
    );

    fireEvent.click(screen.getByTestId("date-set-null"));
    expect(mockOnFieldChange).toHaveBeenLastCalledWith(
      "basicInfo",
      "expiry",
      "",
      undefined
    );
  });

  it("handles Custom Date Formats (dd/mm/yyyy)", () => {
    const props = {
      ...defaultProps,
      formData: {
        basicInfo: { expiry: "15/05/2025" },
      } as any,
    };
    render(<FormSection {...props} />);
    const dateValue = screen.getByTestId("date-value");
    expect(dateValue).toHaveTextContent("2025-05-15");
  });

  it("handles Invalid Date formats gracefully", () => {
    const props = {
      ...defaultProps,
      formData: {
        basicInfo: { expiry: "invalid-date-string" },
      } as any,
    };
    render(<FormSection {...props} />);
    const dateValue = screen.getByTestId("date-value");
    expect(dateValue).toHaveTextContent("null");
  });

  it("handles MultiSelect Parsing logic", () => {
    const { rerender } = render(<FormSection {...defaultProps} />);
    expect(screen.getByTestId("ms-value")).toHaveTextContent('["tag1"]');

    const propsString = {
      ...defaultProps,
      formData: { basicInfo: { tags: "a, b" } } as any,
    };
    rerender(<FormSection {...propsString} />);
    expect(screen.getByTestId("ms-value")).toHaveTextContent('["a","b"]');

    const propsEmpty = {
      ...defaultProps,
      formData: { basicInfo: { tags: null } } as any,
    };
    rerender(<FormSection {...propsEmpty} />);
    expect(screen.getByTestId("ms-value")).toHaveTextContent("[]");

    fireEvent.click(screen.getByTestId("ms-change-btn"));
    expect(mockOnFieldChange).toHaveBeenLastCalledWith(
      "basicInfo",
      "tags",
      ["selected_val"],
      undefined
    );
  });

  it("renders Batch section with Add/Remove buttons", () => {
    const batchProps = {
      ...defaultProps,
      sectionKey: "batch" as any,
      formData: {
        batches: [{ batchNumber: "B1" }, { batchNumber: "B2" }],
      } as any,
      errors: {
        batch: { batchNumber: "Batch Error" },
      } as any,
    };

    render(<FormSection {...batchProps} />);

    expect(screen.getByText("Batch 1")).toBeInTheDocument();
    expect(screen.getByText("Batch 2")).toBeInTheDocument();

    const inputs = screen.getAllByTestId("input-batchNumber");
    expect(inputs[0]).toHaveValue("B1");
    expect(inputs[1]).toHaveValue("B2");

    fireEvent.change(inputs[0], { target: { value: "B1-UPDATED" } });
    expect(mockOnFieldChange).toHaveBeenCalledWith(
      "batch",
      "batchNumber",
      "B1-UPDATED",
      0
    );

    const removeButtons = screen.getAllByText("Remove");
    fireEvent.click(removeButtons[0]);
    expect(mockOnRemoveBatch).toHaveBeenCalledWith(0);

    fireEvent.click(screen.getByText("Add another batch"));
    expect(mockOnAddBatch).toHaveBeenCalled();
  });

  it("renders single Batch fallback if formData.batches is empty/undefined", () => {
    const batchProps = {
      ...defaultProps,
      sectionKey: "batch" as any,
      formData: {
        batches: undefined,
        batch: { batchNumber: "FallbackBatch" },
      } as any,
    };

    render(<FormSection {...batchProps} />);
    expect(screen.getByText("Batch 1")).toBeInTheDocument();
    expect(screen.queryByText("Remove")).not.toBeInTheDocument();
  });

  it("handles Buttons actions and props", () => {
    render(
      <FormSection
        {...defaultProps}
        saveLabel="Custom Save"
        disableSave={false}
      />
    );

    const saveBtn = screen.getByTestId("btn-primary");
    const clearBtn = screen.getByTestId("btn-secondary");

    expect(saveBtn).toHaveTextContent("Custom Save");
    expect(saveBtn).toBeEnabled();

    fireEvent.click(clearBtn);
    expect(mockOnClear).toHaveBeenCalled();

    fireEvent.click(saveBtn);
    expect(mockOnSave).toHaveBeenCalled();
  });
});
