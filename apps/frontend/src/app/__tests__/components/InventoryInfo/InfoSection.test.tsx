import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import InfoSection from "@/app/components/InventoryInfo/InfoSection";
import { InventoryItem } from "@/app/pages/Inventory/types";
import { BusinessType } from "@/app/types/org";

// --- Mocks ---

// Mock EditableAccordion to inspect props passed to it
jest.mock("@/app/components/Accordion/EditableAccordion", () => ({
  __esModule: true,
  default: ({
    title,
    fields,
    data,
    onSave,
    onEditingChange,
    onRegisterActions,
    readOnly,
  }: any) => (
    <div data-testid="mock-accordion">
      <div data-testid="acc-title">{title}</div>
      <div data-testid="acc-readonly">{readOnly ? "true" : "false"}</div>
      <div data-testid="acc-fields">{JSON.stringify(fields)}</div>
      <div data-testid="acc-data">{JSON.stringify(data)}</div>
      <button
        data-testid="trigger-save"
        onClick={() => onSave({ someField: "newValue" })}
      >
        Save
      </button>
      <button
        data-testid="trigger-edit-change"
        // FIX: Use optional chaining to satisfy linter
        onClick={() => onEditingChange?.(true)}
      >
        EditChange
      </button>
      <button
        data-testid="trigger-register"
        // FIX: Use optional chaining
        onClick={() => onRegisterActions?.({ save: async () => {} } as any)}
      >
        Register
      </button>
    </div>
  ),
}));

// Mock InventoryConfig to control the shape of the form being tested
jest.mock("@/app/components/AddInventory/InventoryConfig", () => ({
  InventoryFormConfig: {
    vet: {
      basicInfo: [
        {
          kind: "field",
          field: { name: "name", component: "input", placeholder: "Item Name" },
        },
        {
          kind: "row",
          fields: [
            {
              name: "category",
              component: "dropdown",
              options: ["A", "B"],
              label: "Category Label",
            },
            { name: "expiry", component: "date", placeholder: "Expiry Date" },
          ],
        },
      ],
      emptySection: [], // To test empty state
    },
  },
}));

// --- Test Data ---

const mockInventory: InventoryItem = {
  id: "123",
  basicInfo: {
    name: "Test Item",
    category: "A",
    expiry: "2025-01-01",
  },
} as any;

describe("InfoSection Component", () => {
  const mockOnSaveSection = jest.fn();
  const mockOnEditingChange = jest.fn();
  const mockOnRegisterActions = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering ---

  it("renders the section title and accordion when config exists", () => {
    render(
      <InfoSection
        businessType={"vet" as BusinessType}
        sectionKey="basicInfo"
        sectionTitle="Basic Information"
        inventory={mockInventory}
      />
    );

    // FIX: "Basic Information" appears in main header div AND mocked accordion title.
    // Check for multiple instances or specific testID.
    const titles = screen.getAllByText("Basic Information");
    expect(titles.length).toBeGreaterThanOrEqual(1);

    expect(screen.getByTestId("mock-accordion")).toBeInTheDocument();

    // Verify title passed to accordion specifically
    expect(screen.getByTestId("acc-title")).toHaveTextContent(
      "Basic Information"
    );
  });

  it("renders 'No fields configured' when configuration is empty", () => {
    render(
      <InfoSection
        businessType={"vet" as BusinessType}
        sectionKey={"emptySection" as any}
        sectionTitle="Empty Section"
        inventory={mockInventory}
      />
    );

    expect(
      screen.getByText("No fields configured for this section.")
    ).toBeInTheDocument();
    expect(screen.queryByTestId("mock-accordion")).not.toBeInTheDocument();
  });

  it("renders 'No fields configured' when business type or section does not exist", () => {
    render(
      <InfoSection
        businessType={"retail" as BusinessType}
        sectionKey="basicInfo"
        sectionTitle="Missing Config"
        inventory={mockInventory}
      />
    );

    expect(
      screen.getByText("No fields configured for this section.")
    ).toBeInTheDocument();
  });

  // --- 2. Logic (Field Mapping & Flattening) ---

  it("correctly maps and flattens configuration fields into EditableFields", () => {
    render(
      <InfoSection
        businessType={"vet" as BusinessType}
        sectionKey="basicInfo"
        sectionTitle="Basic Info"
        inventory={mockInventory}
      />
    );

    const fieldsJson = screen.getByTestId("acc-fields").textContent;
    const fields = JSON.parse(fieldsJson || "[]");

    // We expect 3 fields total (1 standalone + 2 in a row)
    expect(fields).toHaveLength(3);

    // 1. Text Input Mapping
    expect(fields[0]).toEqual({
      label: "Item Name",
      key: "name",
      type: "text",
    });

    // 2. Dropdown Mapping
    expect(fields[1]).toEqual({
      label: "Category Label",
      key: "category",
      type: "select",
      options: ["A", "B"],
    });

    // 3. Date Mapping
    expect(fields[2]).toEqual({
      label: "Expiry Date",
      key: "expiry",
      type: "date",
    });
  });

  it("passes the correct data subset to the accordion", () => {
    render(
      <InfoSection
        businessType={"vet" as BusinessType}
        sectionKey="basicInfo"
        sectionTitle="Basic Info"
        inventory={mockInventory}
      />
    );

    const dataJson = screen.getByTestId("acc-data").textContent;
    const data = JSON.parse(dataJson || "{}");

    expect(data).toEqual(mockInventory.basicInfo);
  });

  // --- 3. Interaction (Callbacks) ---

  it("calls onSaveSection with the correct section key when accordion saves", () => {
    render(
      <InfoSection
        businessType={"vet" as BusinessType}
        sectionKey="basicInfo"
        sectionTitle="Basic Info"
        inventory={mockInventory}
        onSaveSection={mockOnSaveSection}
      />
    );

    fireEvent.click(screen.getByTestId("trigger-save"));

    expect(mockOnSaveSection).toHaveBeenCalledWith("basicInfo", {
      someField: "newValue",
    });
  });

  it("propagates onEditingChange callback", () => {
    render(
      <InfoSection
        businessType={"vet" as BusinessType}
        sectionKey="basicInfo"
        sectionTitle="Basic Info"
        inventory={mockInventory}
        onEditingChange={mockOnEditingChange}
      />
    );

    fireEvent.click(screen.getByTestId("trigger-edit-change"));

    expect(mockOnEditingChange).toHaveBeenCalledWith(true);
  });

  it("propagates onRegisterActions callback", () => {
    render(
      <InfoSection
        businessType={"vet" as BusinessType}
        sectionKey="basicInfo"
        sectionTitle="Basic Info"
        inventory={mockInventory}
        onRegisterActions={mockOnRegisterActions}
      />
    );

    fireEvent.click(screen.getByTestId("trigger-register"));

    expect(mockOnRegisterActions).toHaveBeenCalledWith(
      expect.objectContaining({
        save: expect.any(Function),
      })
    );
  });

  // --- 4. Props & Edge Cases ---

  it("passes disableEditing prop to accordion as readOnly", () => {
    const { rerender } = render(
      <InfoSection
        businessType={"vet" as BusinessType}
        sectionKey="basicInfo"
        sectionTitle="Basic Info"
        inventory={mockInventory}
        disableEditing={true}
      />
    );

    expect(screen.getByTestId("acc-readonly")).toHaveTextContent("true");

    rerender(
      <InfoSection
        businessType={"vet" as BusinessType}
        sectionKey="basicInfo"
        sectionTitle="Basic Info"
        inventory={mockInventory}
        disableEditing={false}
      />
    );

    expect(screen.getByTestId("acc-readonly")).toHaveTextContent("false");
  });

  it("handles missing label/placeholder fallback in field mapping", async () => {
    // Modify mock for this specific test case to test fallback to field.name
    jest.resetModules();
    jest.doMock("@/app/components/AddInventory/InventoryConfig", () => ({
      InventoryFormConfig: {
        vet: {
          fallbackTest: [
            {
              kind: "field",
              field: { name: "fallbackField", component: "input" },
            },
          ],
        },
      },
    }));

    // Re-import component to use new mock using dynamic import instead of require
    const { default: ReImportedInfoSection } = await import(
      "@/app/components/InventoryInfo/InfoSection"
    );

    render(
      <ReImportedInfoSection
        businessType={"vet" as BusinessType}
        // FIX: Cast string to 'any' to bypass strict type checking for the test mock key
        sectionKey={"fallbackTest" as any}
        sectionTitle="Fallback Test"
        inventory={mockInventory}
      />
    );

    const fieldsJson = screen.getByTestId("acc-fields").textContent;
    const fields = JSON.parse(fieldsJson || "[]");

    expect(fields[0].label).toBe("fallbackField");
  });
});
