import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import InventoryInfo from "@/app/components/InventoryInfo";
import { InventoryItem } from "@/app/pages/Inventory/types";
import { BusinessType } from "@/app/types/org";

// --- Mocks ---

// Mock InfoSection (Imported component)
jest.mock("@/app/components/InventoryInfo/InfoSection", () => {
  return ({
    onRegisterActions,
    onSaveSection,
    onEditingChange,
    sectionKey,
  }: any) => {
    React.useEffect(() => {
      onRegisterActions({
        save: async () => {
          // Use globalThis instead of window to satisfy linter
          const mockValues = (globalThis as any).__mockInfoValues || {};
          await onSaveSection(sectionKey, mockValues);
        },
        cancel: jest.fn(),
        startEditing: jest.fn(),
        isEditing: () => true,
      });
    }, [onRegisterActions, onSaveSection, sectionKey]);

    return (
      <div data-testid="mock-info-section">
        <button onClick={() => onEditingChange(true)}>Trigger Edit Mode</button>
      </div>
    );
  };
});

// Mock UI Components
jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="mock-modal">{children}</div> : null,
}));

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children, onEditClick }: any) => (
    <div data-testid="mock-accordion">
      <button onClick={onEditClick}>Edit {title}</button>
      {children}
    </div>
  ),
}));

jest.mock("@/app/components/Labels/SubLabels", () => ({
  __esModule: true,
  default: ({ activeLabel, setActiveLabel, labels }: any) => (
    <div data-testid="sub-labels">
      {labels.map((l: any) => (
        <button
          key={l.key}
          onClick={() => setActiveLabel(l.key)}
          data-testid={`tab-${l.key}`}
        >
          {l.name}
        </button>
      ))}
      <div data-testid="active-tab">{activeLabel}</div>
    </div>
  ),
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick, isDisabled }: any) => (
    <button onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
}));

// Mock Inputs used in BatchEditor
jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ value, onChange, inname }: any) => (
    <input data-testid={`input-${inname}`} value={value} onChange={onChange} />
  ),
}));

jest.mock("@/app/components/Inputs/Datepicker", () => ({
  __esModule: true,
  default: ({ currentDate, setCurrentDate }: any) => (
    <input
      data-testid="input-date"
      value={currentDate ? currentDate.toISOString() : ""}
      onChange={(e) => setCurrentDate(new Date(e.target.value))}
    />
  ),
}));

jest.mock("@/app/components/Inputs/Dropdown/LabelDropdown", () => ({
  __esModule: true,
  default: ({ defaultOption, onSelect }: any) => (
    <select
      data-testid="input-dropdown"
      value={defaultOption}
      onChange={(e) => onSelect({ value: e.target.value, label: e.target.value })}
    >
      <option value="opt1">Option 1</option>
      <option value="opt2">Option 2</option>
    </select>
  ),
}));

// Mock Utils
jest.mock("@/app/pages/Inventory/utils", () => ({
  formatDisplayDate: (val: string) => val,
  toStringSafe: (val: any) => String(val || ""),
}));

// Mock Config
jest.mock("@/app/components/AddInventory/InventoryConfig", () => ({
  InventoryFormConfig: {
    vet: {
      batch: [
        {
          kind: "row",
          fields: [
            { name: "batch", component: "input", placeholder: "Batch No" },
            { name: "expiryDate", component: "date", placeholder: "Expiry" },
          ],
        },
        {
          field: {
            name: "serial",
            component: "dropdown",
            options: ["opt1"],
            placeholder: "Serial",
          },
        },
      ],
    },
  },
}));

// --- Test Data ---

const mockInventoryItem: InventoryItem = {
  id: "123",
  status: "ACTIVE",
  basicInfo: {
    name: "Test Item",
    category: "Meds",
    subCategory: "Pills",
  },
  pricing: {
    purchaseCost: "10",
    selling: "20",
  },
  stock: {
    current: "100",
    reorderLevel: "10",
  },
  batches: [
    {
      batch: "B1",
      expiryDate: "2025-01-01",
      serial: "S1",
    },
  ],
} as any;

describe("InventoryInfo Component", () => {
  const mockSetShowModal = jest.fn();
  const mockOnUpdate = jest.fn();
  const mockOnHide = jest.fn();
  const mockOnUnhide = jest.fn();
  const mockOnAddBatch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as any).__mockInfoValues = {};
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  // --- 1. Rendering & Navigation ---

  it("renders nothing if showModal is false", () => {
    render(
      <InventoryInfo
        showModal={false}
        setShowModal={mockSetShowModal}
        activeInventory={mockInventoryItem}
        businessType={"vet" as BusinessType}
        onUpdate={mockOnUpdate}
        onHide={mockOnHide}
        onUnhide={mockOnUnhide}
      />
    );
    expect(screen.queryByTestId("mock-modal")).not.toBeInTheDocument();
  });

  it("renders correctly with active inventory and navigates tabs", () => {
    render(
      <InventoryInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeInventory={mockInventoryItem}
        businessType={"vet" as BusinessType}
        onUpdate={mockOnUpdate}
        onHide={mockOnHide}
        onUnhide={mockOnUnhide}
      />
    );

    expect(screen.getByText("Test Item")).toBeInTheDocument();
    expect(screen.getByTestId("mock-info-section")).toBeInTheDocument();
    expect(screen.getByTestId("active-tab")).toHaveTextContent("basicInfo");

    // Switch to Batch tab
    fireEvent.click(screen.getByTestId("tab-batch"));
    expect(screen.getByTestId("active-tab")).toHaveTextContent("batch");

    // "Batch / Lot details" appears in both Tab Button AND Header Div.
    const headers = screen.getAllByText("Batch / Lot details");
    expect(headers.length).toBeGreaterThanOrEqual(1);

    // Should show existing batch
    expect(screen.getByText("Existing batch 1")).toBeInTheDocument();
  });

  // --- 2. Action Buttons (Hide/Unhide/Close) ---

  it("handles Hide Item action", async () => {
    render(
      <InventoryInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeInventory={{ ...mockInventoryItem, status: "ACTIVE" }}
        businessType={"vet" as BusinessType}
        onUpdate={mockOnUpdate}
        onHide={mockOnHide}
        onUnhide={mockOnUnhide}
      />
    );

    const hideBtn = screen.getByText("Hide item");
    fireEvent.click(hideBtn);

    expect(hideBtn).toBeDisabled();
    await waitFor(() => expect(mockOnHide).toHaveBeenCalledWith("123"));
    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });

  it("handles Unhide Item action", async () => {
    render(
      <InventoryInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeInventory={{ ...mockInventoryItem, status: "HIDDEN" }}
        businessType={"vet" as BusinessType}
        onUpdate={mockOnUpdate}
        onHide={mockOnHide}
        onUnhide={mockOnUnhide}
      />
    );

    const unhideBtn = screen.getByText("Unhide item");
    fireEvent.click(unhideBtn);

    expect(unhideBtn).toBeDisabled();
    await waitFor(() => expect(mockOnUnhide).toHaveBeenCalledWith("123"));
    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });

  it("handles Close Modal action", () => {
    render(
      <InventoryInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeInventory={mockInventoryItem}
        businessType={"vet" as BusinessType}
        onUpdate={mockOnUpdate}
        onHide={mockOnHide}
        onUnhide={mockOnUnhide}
      />
    );

    fireEvent.click(screen.getByText("Close"));
    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });

  // --- 3. Editing Info Section (Integration with Mock) ---

  it("handles Edit -> Save flow for InfoSection", async () => {
    render(
      <InventoryInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeInventory={mockInventoryItem}
        businessType={"vet" as BusinessType}
        onUpdate={mockOnUpdate}
        onHide={mockOnHide}
        onUnhide={mockOnUnhide}
      />
    );

    // Enter Edit Mode via child trigger
    fireEvent.click(screen.getByText("Trigger Edit Mode"));

    // Buttons change
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();

    // Setup success values for the mock
    (globalThis as any).__mockInfoValues = {
      name: "Updated Name",
      category: "Cat",
      subCategory: "Sub",
    };

    // Click Save
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => expect(mockOnUpdate).toHaveBeenCalled());

    const calledArg = mockOnUpdate.mock.calls[0][0];
    expect(calledArg.basicInfo.name).toBe("Updated Name");
  });

  // --- 4. Validation Logic ---

  it("validates Pricing requirements", async () => {
    render(
      <InventoryInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeInventory={mockInventoryItem}
        businessType={"vet" as BusinessType}
        onUpdate={mockOnUpdate}
        onHide={mockOnHide}
        onUnhide={mockOnUnhide}
      />
    );

    // Switch to Pricing tab
    fireEvent.click(screen.getByTestId("tab-pricing"));
    // The mock InfoSection will re-register its save action
    fireEvent.click(screen.getByText("Trigger Edit Mode"));

    // Set Invalid Pricing Values (NaN and Empty)
    (globalThis as any).__mockInfoValues = { purchaseCost: "abc", selling: "" };

    fireEvent.click(screen.getByText("Save"));

    // Expect console error logging validation failure
    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Validation failed"),
        expect.stringContaining("selling")
      );
    });
    expect(mockOnUpdate).not.toHaveBeenCalled();
  });

  // --- 5. BatchEditor Integration ---

  it("handles Adding a New Batch", async () => {
    render(
      <InventoryInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeInventory={mockInventoryItem}
        businessType={"vet" as BusinessType}
        onUpdate={mockOnUpdate}
        onHide={mockOnHide}
        onUnhide={mockOnUnhide}
        onAddBatch={mockOnAddBatch}
      />
    );

    // Switch to Batch tab
    fireEvent.click(screen.getByTestId("tab-batch"));

    // Click "Edit Batch / Lot details" (Accordion button)
    const editBtn = screen.getByRole("button", {
      name: /Edit Batch \/ Lot details/i,
    });
    fireEvent.click(editBtn);

    // Initial state: 1 batch auto-created
    expect(screen.getByText("New batch 1")).toBeInTheDocument();

    // Click Add another batch -> 2 batches
    fireEvent.click(screen.getByText("Add another batch"));
    expect(screen.getByText("New batch 2")).toBeInTheDocument();

    // Fill inputs for the SECOND batch (index 1)
    const batchInputs = screen.getAllByTestId("input-batch");
    expect(batchInputs).toHaveLength(2);
    fireEvent.change(batchInputs[1], { target: { value: "NEW_B_2" } });

    // Click Save
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => expect(mockOnAddBatch).toHaveBeenCalled());

    const calledArgs = mockOnAddBatch.mock.calls[0];
    // We expect the payload to contain the non-empty batch data (Batch 2)
    expect(calledArgs[1]).toHaveLength(1);
    expect(calledArgs[1][0].batch).toBe("NEW_B_2");
  });

  it("removes a new batch and handles empty save validation", async () => {
    render(
      <InventoryInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeInventory={mockInventoryItem}
        businessType={"vet" as BusinessType}
        onUpdate={mockOnUpdate}
        onHide={mockOnHide}
        onUnhide={mockOnUnhide}
        onAddBatch={mockOnAddBatch}
      />
    );

    fireEvent.click(screen.getByTestId("tab-batch"));
    const editBtn = screen.getByRole("button", {
      name: /Edit Batch \/ Lot details/i,
    });
    fireEvent.click(editBtn);

    // Add another batch (Total 2)
    fireEvent.click(screen.getByText("Add another batch"));

    expect(screen.getByText("New batch 2")).toBeInTheDocument();

    // Remove Batch 2
    const removeBtns = screen.getAllByText("Remove");
    fireEvent.click(removeBtns[1]);

    // Wait for removal
    await waitFor(() => {
      expect(screen.queryByText("New batch 2")).not.toBeInTheDocument();
    });

    // Try to save with the remaining empty batch
    fireEvent.click(screen.getByText("Save"));

    // Should fail validation (meaningfulNew check)
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Batch validation failed"),
        expect.any(String)
      )
    );
    expect(mockOnAddBatch).not.toHaveBeenCalled();
  });

  it("handles BatchEditor inputs (Date & Dropdown)", async () => {
    render(
      <InventoryInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeInventory={mockInventoryItem}
        businessType={"vet" as BusinessType}
        onUpdate={mockOnUpdate}
        onHide={mockOnHide}
        onUnhide={mockOnUnhide}
        onAddBatch={mockOnAddBatch}
      />
    );

    fireEvent.click(screen.getByTestId("tab-batch"));
    const editBtn = screen.getByRole("button", {
      name: /Edit Batch \/ Lot details/i,
    });
    fireEvent.click(editBtn);

    // Date Input (Default Batch 1)
    const dateInputs = screen.getAllByTestId("input-date");
    fireEvent.change(dateInputs[0], { target: { value: "2025-12-31" } });

    // Dropdown Input
    const dropInputs = screen.getAllByTestId("input-dropdown");
    fireEvent.change(dropInputs[0], { target: { value: "opt1" } });

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => expect(mockOnAddBatch).toHaveBeenCalled());
    const payload = mockOnAddBatch.mock.calls[0][1][0];
    expect(payload.expiryDate).toContain("2025-12-31");
    expect(payload.serial).toBe("opt1");
  });
});
