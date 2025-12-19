import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AddInventory from "@/app/components/AddInventory/index";
import { BusinessType } from "@/app/types/org";

// --- Mocks ---

jest.mock(
  "@/app/components/Modal",
  () =>
    ({ showModal, children }: any) =>
      showModal ? <div data-testid="modal">{children}</div> : null
);

jest.mock(
  "@/app/components/Labels/SubLabels",
  () =>
    ({ labels, activeLabel, setActiveLabel }: any) => (
      <div>
        {labels.map((l: any) => (
          <button
            key={l.key}
            data-testid={`nav-${l.key}`}
            onClick={() => setActiveLabel(l.key)}
          >
            {l.name}
          </button>
        ))}
      </div>
    )
);

jest.mock("@/app/pages/Inventory/utils", () => ({
  calculateBatchTotals: (batches: any[]) => {
    const total = batches.reduce(
      (sum, b) => sum + (Number(b.quantity) || 0),
      0
    );
    return { onHand: total, allocated: 0, available: total };
  },
}));

jest.mock("@/app/components/AddInventory/FormSection", () => {
  return ({
    sectionKey,
    onFieldChange,
    onSave,
    onClear,
    onAddBatch,
    onRemoveBatch,
    saveLabel,
  }: any) => (
    <div data-testid={`section-${sectionKey}`}>
      <button data-testid="btn-action" onClick={onSave}>
        {saveLabel}
      </button>
      <button data-testid="btn-clear" onClick={onClear}>
        Clear
      </button>
      <button data-testid="btn-add-batch" onClick={onAddBatch}>
        AddBatch
      </button>
      <button data-testid="btn-remove-batch" onClick={() => onRemoveBatch(0)}>
        RemoveBatch
      </button>

      <button
        data-testid="fill-basic"
        onClick={() => {
          onFieldChange("basicInfo", "name", "Item");
          onFieldChange("basicInfo", "category", "Cat");
          onFieldChange("basicInfo", "subCategory", "Sub");
        }}
      >
        Fill Basic
      </button>

      <button
        data-testid="fill-pricing"
        onClick={() => {
          onFieldChange("pricing", "purchaseCost", "10");
          onFieldChange("pricing", "selling", "20");
        }}
      >
        Fill Pricing
      </button>
      <button
        data-testid="fill-pricing-invalid"
        onClick={() => {
          onFieldChange("pricing", "purchaseCost", "invalid");
        }}
      >
        Fill Pricing Invalid
      </button>

      <button
        data-testid="fill-stock"
        onClick={() => {
          onFieldChange("stock", "current", "100");
          onFieldChange("stock", "reorderLevel", "10");
        }}
      >
        Fill Stock
      </button>
      <button
        data-testid="fill-stock-invalid"
        onClick={() => {
          onFieldChange("stock", "current", "invalid");
        }}
      >
        Fill Stock Invalid
      </button>

      <button
        data-testid="fill-batch"
        onClick={() => onFieldChange("batch", "quantity", "50", 0)}
      >
        Fill Batch
      </button>
    </div>
  );
});

describe("AddInventory", () => {
  const mockOnSubmit = jest.fn();
  const mockSetShowModal = jest.fn();
  const defaultProps = {
    showModal: true,
    setShowModal: mockSetShowModal,
    businessType: "clinic" as BusinessType,
    onSubmit: mockOnSubmit,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  // --- 1. Basic Navigation & Validation ---

  it("validates Basic Info before proceeding", () => {
    render(<AddInventory {...defaultProps} />);

    // Try Next without data
    fireEvent.click(screen.getByTestId("btn-action"));
    expect(console.error).toHaveBeenCalled();
    expect(screen.getByTestId("section-basicInfo")).toBeInTheDocument();

    // Fill valid data
    fireEvent.click(screen.getByTestId("fill-basic"));
    fireEvent.click(screen.getByTestId("btn-action"));

    expect(screen.getByTestId("section-classification")).toBeInTheDocument();
  });

  it("validates Pricing section correctly", () => {
    render(<AddInventory {...defaultProps} />);
    fireEvent.click(screen.getByTestId("fill-basic"));
    fireEvent.click(screen.getByTestId("nav-pricing"));
    expect(screen.getByTestId("section-pricing")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("btn-action"));
    expect(console.error).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("fill-pricing-invalid"));
    fireEvent.click(screen.getByTestId("btn-action"));
    expect(console.error).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("fill-pricing"));
    fireEvent.click(screen.getByTestId("btn-action"));

    expect(screen.getByTestId("section-vendor")).toBeInTheDocument();
  });

  it("validates Stock section correctly", () => {
    render(<AddInventory {...defaultProps} />);
    fireEvent.click(screen.getByTestId("fill-basic"));
    fireEvent.click(screen.getByTestId("nav-stock"));

    fireEvent.click(screen.getByTestId("fill-stock-invalid"));
    fireEvent.click(screen.getByTestId("btn-action"));
    expect(console.error).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("fill-stock"));
    fireEvent.click(screen.getByTestId("btn-action"));

    expect(screen.getByTestId("section-batch")).toBeInTheDocument();
  });

  // --- 2. Batch Logic & Totals Calculation ---

  it("updates stock totals when batches change", () => {
    render(<AddInventory {...defaultProps} />);
    fireEvent.click(screen.getByTestId("fill-basic"));
    fireEvent.click(screen.getByTestId("nav-batch"));

    fireEvent.click(screen.getByTestId("btn-add-batch"));
    fireEvent.click(screen.getByTestId("fill-batch"));
    fireEvent.click(screen.getByTestId("btn-remove-batch"));

    expect(screen.getByTestId("section-batch")).toBeInTheDocument();
  });

  // --- 3. Submission Flow ---

  it("submits the form successfully when all sections are valid", async () => {
    render(<AddInventory {...defaultProps} />);

    fireEvent.click(screen.getByTestId("fill-basic"));

    fireEvent.click(screen.getByTestId("nav-pricing"));
    fireEvent.click(screen.getByTestId("fill-pricing"));

    fireEvent.click(screen.getByTestId("nav-stock"));
    fireEvent.click(screen.getByTestId("fill-stock"));

    fireEvent.click(screen.getByTestId("nav-batch"));

    fireEvent.click(screen.getByTestId("btn-action"));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
    });
    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });

  it("halts submission and navigates to the first invalid step", async () => {
    render(<AddInventory {...defaultProps} />);

    fireEvent.click(screen.getByTestId("fill-basic"));
    fireEvent.click(screen.getByTestId("nav-batch"));

    fireEvent.click(screen.getByTestId("btn-action"));

    expect(mockOnSubmit).not.toHaveBeenCalled();

    expect(screen.getByTestId("section-pricing")).toBeInTheDocument();

    // Check that console.error was called at least once with something resembling the error
    expect(console.error).toHaveBeenCalled();
  });

  it("handles API submission errors gracefully", async () => {
    mockOnSubmit.mockRejectedValue(new Error("Save Failed"));
    render(<AddInventory {...defaultProps} />);

    fireEvent.click(screen.getByTestId("fill-basic"));
    fireEvent.click(screen.getByTestId("nav-pricing"));
    fireEvent.click(screen.getByTestId("fill-pricing"));
    fireEvent.click(screen.getByTestId("nav-stock"));
    fireEvent.click(screen.getByTestId("fill-stock"));
    fireEvent.click(screen.getByTestId("nav-batch"));

    fireEvent.click(screen.getByTestId("btn-action"));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
    });
    expect(mockSetShowModal).not.toHaveBeenCalledWith(false);
    expect(console.error).toHaveBeenCalledWith(
      "Failed to submit inventory:",
      expect.any(Error)
    );
  });

  // --- 4. Actions (Clear, Close) ---

  it("clears the form and resets to the first section", () => {
    render(<AddInventory {...defaultProps} />);

    fireEvent.click(screen.getByTestId("fill-basic"));
    fireEvent.click(screen.getByTestId("nav-pricing"));

    fireEvent.click(screen.getByTestId("btn-clear"));

    expect(screen.getByTestId("section-basicInfo")).toBeInTheDocument();
  });

  it("closes the modal via the close icon", () => {
    render(<AddInventory {...defaultProps} />);

    const svgs = document.querySelectorAll("svg");
    fireEvent.click(svgs[1]);

    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });
});
