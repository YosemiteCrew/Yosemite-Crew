import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import AddInventory from "@/app/features/inventory/components/AddInventory";
import { BusinessType } from "@/app/features/organization/types/org";
import * as InventoryUtils from "@/app/features/inventory/pages/Inventory/utils";

// ----------------------------------------------------------------------------
// Mocks & Setup
// ----------------------------------------------------------------------------

jest.mock("@/app/features/inventory/pages/Inventory/utils", () => ({
  calculateBatchTotals: jest.fn(() => ({
    onHand: 100,
    allocated: 0,
    available: 100,
  })),
}));

// Mock Config - simplified structure for testing
jest.mock("@/app/features/inventory/components/AddInventory/InventoryConfig", () => ({
  InventoryFormConfig: {
    VETERINARY: {
      basicInfo: [],
      classification: [],
      pricing: [],
      vendor: [],
      stock: [],
      batch: [],
    },
  },
}));

// *** SMART MOCK for FormSection ***
// This mock renders inputs for ALL possible validation fields regardless of the active sectionKey.
// This allows us to drive the internal state of the parent component completely from the test.
jest.mock("@/app/features/inventory/components/AddInventory/FormSection", () => ({
  __esModule: true,
  default: ({
    sectionKey,
    onFieldChange,
    onSave,
    saveLabel,
    onAddBatch,
    onRemoveBatch,
  }: any) => (
    <div data-testid={`section-${sectionKey}`}>
      <button data-testid="save-btn" onClick={onSave}>
        {saveLabel}
      </button>

      {/* Basic Info Fields */}
      <input
        data-testid="in-name"
        onChange={(e) => onFieldChange("basicInfo", "name", e.target.value)}
      />
      <input
        data-testid="in-cat"
        onChange={(e) => onFieldChange("basicInfo", "category", e.target.value)}
      />
      <input
        data-testid="in-sub"
        onChange={(e) =>
          onFieldChange("basicInfo", "subCategory", e.target.value)
        }
      />

      {/* Pricing Fields */}
      <input
        data-testid="in-cost"
        onChange={(e) =>
          onFieldChange("pricing", "purchaseCost", e.target.value)
        }
      />
      <input
        data-testid="in-sell"
        onChange={(e) => onFieldChange("pricing", "selling", e.target.value)}
      />

      {/* Stock Fields */}
      <input
        data-testid="in-curr"
        onChange={(e) => onFieldChange("stock", "current", e.target.value)}
      />
      <input
        data-testid="in-reorder"
        onChange={(e) => onFieldChange("stock", "reorderLevel", e.target.value)}
      />

      {/* Batch Actions */}
      <button data-testid="add-batch" onClick={onAddBatch}>
        Add Batch
      </button>
      <button data-testid="remove-batch" onClick={() => onRemoveBatch(0)}>
        Remove Batch
      </button>
      <input
        data-testid="in-batch-0"
        onChange={(e) => onFieldChange("batch", "batch", e.target.value, 0)}
      />
    </div>
  ),
}));

jest.mock("@/app/ui/overlays/Modal", () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div>{children}</div> : null,
}));

jest.mock("@/app/ui/widgets/Labels/Labels", () => ({
  __esModule: true,
  default: ({ activeLabel, setActiveLabel, statuses }: any) => (
    <div data-testid="labels">
      <span data-testid="active-label">{activeLabel}</span>
      <button
        data-testid="go-basic"
        onClick={() => setActiveLabel("basicInfo")}
      >
        Basic
      </button>
      <button data-testid="go-stock" onClick={() => setActiveLabel("stock")}>
        Stock
      </button>
      {statuses?.basicInfo === "error" && (
        <span data-testid="basic-error">Error</span>
      )}
    </div>
  ),
}));

jest.mock("@/app/ui/primitives/Icons/Close", () => ({
  __esModule: true,
  default: ({ onClick }: any) => <button onClick={onClick}>Close</button>,
}));

describe("AddInventory Component", () => {
  const mockSubmit = jest.fn();
  const mockSetShowModal = jest.fn();
  const props = {
    showModal: true,
    setShowModal: mockSetShowModal,
    businessType: "VETERINARY" as BusinessType,
    onSubmit: mockSubmit,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Tests
  // --------------------------------------------------------------------------

  it("validates Basic Info and blocks navigation on error", async () => {
    render(<AddInventory {...props} />);

    // Attempt to click Next without filling required fields
    fireEvent.click(screen.getByTestId("save-btn"));

    // Validation should fail, keeping us on 'basicInfo' and showing error state
    expect(screen.getByTestId("active-label")).toHaveTextContent("basicInfo");
    expect(screen.getByTestId("basic-error")).toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("progresses through all sections when valid", async () => {
    render(<AddInventory {...props} />);

    // 1. Fill Basic Info
    fireEvent.change(screen.getByTestId("in-name"), {
      target: { value: "Item 1" },
    });
    fireEvent.change(screen.getByTestId("in-cat"), {
      target: { value: "Cat 1" },
    });
    fireEvent.change(screen.getByTestId("in-sub"), {
      target: { value: "Sub 1" },
    });
    fireEvent.click(screen.getByTestId("save-btn")); // Next

    expect(screen.getByTestId("active-label")).toHaveTextContent(
      "classification",
    );

    // 2. Classification (No validation logic in component)
    fireEvent.click(screen.getByTestId("save-btn")); // Next
    expect(screen.getByTestId("active-label")).toHaveTextContent("pricing");

    // 3. Pricing
    fireEvent.change(screen.getByTestId("in-cost"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByTestId("in-sell"), {
      target: { value: "20" },
    });
    fireEvent.click(screen.getByTestId("save-btn")); // Next
    expect(screen.getByTestId("active-label")).toHaveTextContent("vendor");

    // 4. Vendor (No validation)
    fireEvent.click(screen.getByTestId("save-btn")); // Next
    expect(screen.getByTestId("active-label")).toHaveTextContent("stock");

    // 5. Stock
    fireEvent.change(screen.getByTestId("in-curr"), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByTestId("in-reorder"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByTestId("save-btn")); // Next
    expect(screen.getByTestId("active-label")).toHaveTextContent("batch");

    // 6. Batch (Final Save)
    fireEvent.change(screen.getByTestId("in-batch-0"), {
      target: { value: "B1" },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("save-btn")); // Save All
    });

    expect(mockSubmit).toHaveBeenCalled();
    // Upon success, modal should close and form reset
    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });

  it("validates numeric fields (Pricing) correctly", async () => {
    render(<AddInventory {...props} />);

    // Advance to pricing (filling basic info)
    fireEvent.change(screen.getByTestId("in-name"), { target: { value: "A" } });
    fireEvent.change(screen.getByTestId("in-cat"), { target: { value: "A" } });
    fireEvent.change(screen.getByTestId("in-sub"), { target: { value: "A" } });
    fireEvent.click(screen.getByTestId("save-btn")); // basic -> class
    fireEvent.click(screen.getByTestId("save-btn")); // class -> pricing

    // Invalid Price (Non-numeric)
    fireEvent.change(screen.getByTestId("in-cost"), {
      target: { value: "abc" },
    });
    fireEvent.click(screen.getByTestId("save-btn"));

    // Should stay on pricing due to validation error
    expect(screen.getByTestId("active-label")).toHaveTextContent("pricing");
  });

  it("handles batch add/remove and total calculation", async () => {
    render(<AddInventory {...props} />);

    // Add Batch
    fireEvent.click(screen.getByTestId("add-batch"));
    expect(InventoryUtils.calculateBatchTotals).toHaveBeenCalled();

    // Remove Batch
    fireEvent.click(screen.getByTestId("remove-batch"));
    expect(InventoryUtils.calculateBatchTotals).toHaveBeenCalled();
  });

  it("prevents submission if validation fails (Jump Check)", async () => {
    render(<AddInventory {...props} />);
    // Jump to Stock section directly (using label mock)
    fireEvent.click(screen.getByTestId("go-stock"));

    // Try to save (Stock is empty/invalid)
    // The validateAll() logic iterates all sections. It should fail on Basic Info first.
    fireEvent.click(screen.getByTestId("save-btn"));

    // Should jump to first invalid section (basicInfo)
    expect(screen.getByTestId("active-label")).toHaveTextContent("basicInfo");
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("handles API failure gracefully", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    mockSubmit.mockRejectedValue(new Error("Fail"));

    render(<AddInventory {...props} />);
    // Fill all required fields validly
    fireEvent.change(screen.getByTestId("in-name"), { target: { value: "A" } });
    fireEvent.change(screen.getByTestId("in-cat"), { target: { value: "A" } });
    fireEvent.change(screen.getByTestId("in-sub"), { target: { value: "A" } });
    fireEvent.change(screen.getByTestId("in-cost"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByTestId("in-sell"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByTestId("in-curr"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByTestId("in-reorder"), {
      target: { value: "10" },
    });

    // Click through to submit
    fireEvent.click(screen.getByTestId("save-btn")); // basic -> class
    fireEvent.click(screen.getByTestId("save-btn")); // class -> pricing
    fireEvent.click(screen.getByTestId("save-btn")); // pricing -> vendor
    fireEvent.click(screen.getByTestId("save-btn")); // vendor -> stock
    fireEvent.click(screen.getByTestId("save-btn")); // stock -> batch

    await act(async () => {
      fireEvent.click(screen.getByTestId("save-btn")); // batch -> submit
    });

    expect(mockSubmit).toHaveBeenCalled();
    // Should NOT close modal on error
    expect(mockSetShowModal).not.toHaveBeenCalledWith(false);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
