import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ProtectedFinance from "../../../pages/Finance";
import { useInvoicesForPrimaryOrg } from "@/app/hooks/useInvoices";

// --- Mocks ---

// 1. Mock the Hook
jest.mock("@/app/hooks/useInvoices");

// 2. Mock Wrapper Components
jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: any) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

jest.mock("@/app/components/OrgGuard", () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="org-guard">{children}</div>,
}));

// 3. Mock Child Components
jest.mock("@/app/components/Filters/InvoicesFilers", () => ({
  __esModule: true,
  default: ({ list }: any) => (
    <div data-testid="filters">Filters (Count: {list.length})</div>
  ),
}));

jest.mock("@/app/components/DataTable/InvoiceTable", () => ({
  __esModule: true,
  default: ({ setViewInvoice, setActiveInvoice }: any) => (
    <div data-testid="invoice-table">
      <button data-testid="view-btn" onClick={() => setViewInvoice(true)}>
        View
      </button>
      <button
        data-testid="select-btn"
        onClick={() => setActiveInvoice({ id: "manual-select" })}
      >
        Select
      </button>
    </div>
  ),
}));

// FIXED: Correct relative path for mocking InvoiceInfo
jest.mock("../../../pages/Finance/Sections/InvoiceInfo", () => ({
  __esModule: true,
  default: ({ activeInvoice, showModal, setShowModal }: any) =>
    showModal ? (
      <div data-testid="invoice-info-modal">
        Modal for: {activeInvoice.id}
        <button data-testid="close-modal" onClick={() => setShowModal(false)}>
          Close
        </button>
      </div>
    ) : null,
}));

// --- Test Data ---

const mockInvoices = [
  { id: "inv-1", total: 100 },
  { id: "inv-2", total: 200 },
];

describe("Finance Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useInvoicesForPrimaryOrg as jest.Mock).mockReturnValue(mockInvoices);
  });

  // --- Section 1: Rendering & Structure ---

  it("renders the page structure and guards", () => {
    render(<ProtectedFinance />);

    // Wrappers
    expect(screen.getByTestId("protected-route")).toBeInTheDocument();
    expect(screen.getByTestId("org-guard")).toBeInTheDocument();

    // Title
    expect(screen.getByText("Finance")).toBeInTheDocument();

    // Children
    expect(screen.getByTestId("filters")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-table")).toBeInTheDocument();
  });

  // --- Section 2: Component Interactions ---

  it("opens the InvoiceInfo modal when View is clicked in the table", () => {
    render(<ProtectedFinance />);

    // Modal should be hidden initially (viewInvoice = false)
    expect(screen.queryByTestId("invoice-info-modal")).not.toBeInTheDocument();

    // Click view in table mock
    fireEvent.click(screen.getByTestId("view-btn"));

    // Modal should appear
    expect(screen.getByTestId("invoice-info-modal")).toBeInTheDocument();
    expect(screen.getByText("Modal for: inv-1")).toBeInTheDocument();
  });

  it("closes the modal when requested", () => {
    render(<ProtectedFinance />);

    // Open it first
    fireEvent.click(screen.getByTestId("view-btn"));
    expect(screen.getByTestId("invoice-info-modal")).toBeInTheDocument();

    // Close it
    fireEvent.click(screen.getByTestId("close-modal"));
    expect(screen.queryByTestId("invoice-info-modal")).not.toBeInTheDocument();
  });

  it("allows manual selection of active invoice via table", () => {
    render(<ProtectedFinance />);

    // Default active is inv-1
    fireEvent.click(screen.getByTestId("view-btn"));
    expect(screen.getByText("Modal for: inv-1")).toBeInTheDocument();

    // Manually select via table button
    fireEvent.click(screen.getByTestId("select-btn"));

    // Verify modal now shows the manually selected ID
    expect(screen.getByText("Modal for: manual-select")).toBeInTheDocument();
  });

  // --- Section 3: useEffect Logic (Active Invoice State) ---

  it("defaults activeInvoice to the first item on load", () => {
    render(<ProtectedFinance />);
    // Check filter prop to confirm list passed
    expect(screen.getByText("Filters (Count: 2)")).toBeInTheDocument();

    // Check modal content (by opening it) to verify activeInvoice is index 0
    fireEvent.click(screen.getByTestId("view-btn"));
    expect(screen.getByText("Modal for: inv-1")).toBeInTheDocument();
  });

  it("updates activeInvoice logic: keeps selection if ID exists in new list", () => {
    const { rerender } = render(<ProtectedFinance />);

    // Initial: active is inv-1
    fireEvent.click(screen.getByTestId("view-btn"));
    expect(screen.getByText("Modal for: inv-1")).toBeInTheDocument();

    // Update hook: inv-1 still exists, but maybe data changed slightly
    const updatedList = [
      { id: "inv-1", total: 999 },
      { id: "inv-3", total: 300 },
    ];
    (useInvoicesForPrimaryOrg as jest.Mock).mockReturnValue(updatedList);

    rerender(<ProtectedFinance />);

    // Should still be inv-1
    expect(screen.getByText("Modal for: inv-1")).toBeInTheDocument();
  });

  it("updates activeInvoice logic: fallbacks to first item if selection is removed", () => {
    const { rerender } = render(<ProtectedFinance />);

    // Initial: active is inv-1
    fireEvent.click(screen.getByTestId("view-btn"));
    expect(screen.getByText("Modal for: inv-1")).toBeInTheDocument();

    // Update hook: inv-1 is deleted, inv-2 remains
    const updatedList = [{ id: "inv-2", total: 200 }];
    (useInvoicesForPrimaryOrg as jest.Mock).mockReturnValue(updatedList);

    rerender(<ProtectedFinance />);

    // Should switch to inv-2 (the new index 0)
    expect(screen.getByText("Modal for: inv-2")).toBeInTheDocument();
  });

  it("updates activeInvoice logic: handles empty list", () => {
    const { rerender } = render(<ProtectedFinance />);

    // Update hook: empty list
    (useInvoicesForPrimaryOrg as jest.Mock).mockReturnValue([]);

    rerender(<ProtectedFinance />);

    // Modal content should not render because activeInvoice is null
    // Even if viewInvoice is true, the component checks {activeInvoice && ...}
    fireEvent.click(screen.getByTestId("view-btn"));
    expect(screen.queryByTestId("invoice-info-modal")).not.toBeInTheDocument();
  });

  it("handles initialization with empty list", () => {
    (useInvoicesForPrimaryOrg as jest.Mock).mockReturnValue([]);
    render(<ProtectedFinance />);

    expect(screen.getByText("Filters (Count: 0)")).toBeInTheDocument();
    expect(screen.queryByTestId("invoice-info-modal")).not.toBeInTheDocument();
  });
});
