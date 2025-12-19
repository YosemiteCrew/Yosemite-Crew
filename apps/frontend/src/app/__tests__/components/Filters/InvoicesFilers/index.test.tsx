import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import InvoicesFilters from "@/app/components/Filters/InvoicesFilers";
import { Invoice } from "@yosemite-crew/types";

// --- Mocks ---

// Mock Search Component
jest.mock("@/app/components/Inputs/Search", () => ({
  __esModule: true,
  default: ({ value, setSearch }: any) => (
    <input
      data-testid="search-input"
      value={value}
      onChange={(e) => setSearch(e.target.value)}
    />
  ),
}));

// --- Test Data ---

const mockInvoices: Invoice[] = [
  {
    id: "1",
    status: "paid",
    parentId: "John Doe",
    companionId: "Buddy",
  },
  {
    id: "2",
    status: "pending",
    parentId: "Jane Smith",
    companionId: "Mittens",
  },
  {
    id: "3",
    status: "failed",
    parentId: "John Doe",
    companionId: "Rex",
  },
  {
    id: "4",
    status: "paid",
    parentId: "Alice",
    companionId: "Shadow",
  },
] as any;

describe("InvoicesFilters Component", () => {
  const mockSetFilteredList = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Initial Render & Defaults ---

  it("renders filter buttons and search input", () => {
    render(
      <InvoicesFilters
        list={mockInvoices}
        setFilteredList={mockSetFilteredList}
      />
    );

    // Category Button (Only 'All' is in the array currently)
    const categoryAllBtns = screen.getAllByRole("button", { name: "All" });
    // Expect at least one (Category All + Status All)
    expect(categoryAllBtns.length).toBeGreaterThanOrEqual(1);

    // Status Buttons
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();

    // Search Input
    expect(screen.getByTestId("search-input")).toBeInTheDocument();
  });

  it("initializes with default filters (All/All) and returns full list", () => {
    render(
      <InvoicesFilters
        list={mockInvoices}
        setFilteredList={mockSetFilteredList}
      />
    );

    expect(mockSetFilteredList).toHaveBeenCalledWith(mockInvoices);
  });

  // --- 2. Filtering Logic (Status) ---

  it("filters by Status (Paid)", () => {
    render(
      <InvoicesFilters
        list={mockInvoices}
        setFilteredList={mockSetFilteredList}
      />
    );

    const paidBtn = screen.getByRole("button", { name: "Paid" });
    fireEvent.click(paidBtn);

    // Should match invoices 1 and 4
    expect(mockSetFilteredList).toHaveBeenLastCalledWith([
      mockInvoices[0],
      mockInvoices[3],
    ]);
  });

  it("filters by Status (Pending)", () => {
    render(
      <InvoicesFilters
        list={mockInvoices}
        setFilteredList={mockSetFilteredList}
      />
    );

    const pendingBtn = screen.getByRole("button", { name: "Pending" });
    fireEvent.click(pendingBtn);

    // Should match invoice 2
    expect(mockSetFilteredList).toHaveBeenLastCalledWith([mockInvoices[1]]);
  });

  // --- 3. Filtering Logic (Search) ---

  it("filters by Search matching Parent ID", () => {
    render(
      <InvoicesFilters
        list={mockInvoices}
        setFilteredList={mockSetFilteredList}
      />
    );

    const searchInput = screen.getByTestId("search-input");

    // Search "John"
    fireEvent.change(searchInput, { target: { value: "John" } });

    // Matches invoices 1 and 3 (Parent: John Doe)
    expect(mockSetFilteredList).toHaveBeenLastCalledWith([
      mockInvoices[0],
      mockInvoices[2],
    ]);
  });

  it("filters by Search matching Companion ID", () => {
    render(
      <InvoicesFilters
        list={mockInvoices}
        setFilteredList={mockSetFilteredList}
      />
    );

    const searchInput = screen.getByTestId("search-input");

    // Search "Mittens"
    fireEvent.change(searchInput, { target: { value: "Mittens" } });

    // Matches invoice 2
    expect(mockSetFilteredList).toHaveBeenLastCalledWith([mockInvoices[1]]);
  });

  // --- 4. Complex Logic & Styling ---

  it("filters correctly with combined Status and Search", () => {
    render(
      <InvoicesFilters
        list={mockInvoices}
        setFilteredList={mockSetFilteredList}
      />
    );

    // 1. Set Status to "Paid"
    fireEvent.click(screen.getByRole("button", { name: "Paid" }));

    // 2. Search "Shadow"
    fireEvent.change(screen.getByTestId("search-input"), {
      target: { value: "Shadow" },
    });

    // Should match invoice 4 (Paid / Companion Shadow)
    expect(mockSetFilteredList).toHaveBeenLastCalledWith([mockInvoices[3]]);
  });

  it("applies active styles to selected status button", () => {
    render(
      <InvoicesFilters
        list={mockInvoices}
        setFilteredList={mockSetFilteredList}
      />
    );

    // Note: There are two "All" buttons (Category & Status).
    // The Status "All" is the second one in DOM order based on component structure.
    const allButtons = screen.getAllByRole("button", { name: "All" });
    const statusAllBtn = allButtons[1];
    const paidBtn = screen.getByRole("button", { name: "Paid" });

    // Default: 'All' status active
    expect(statusAllBtn.className).toContain("shadow");
    expect(paidBtn.className).toContain("border-0");

    // Click 'Paid'
    fireEvent.click(paidBtn);

    // Now 'Paid' active
    expect(paidBtn.className).toContain("shadow");

    // Check dynamic style prop (border color matching text color when active)
    // Paid config: text: "#54B492"
    expect(paidBtn).toHaveStyle("border-color: #54B492");
  });

  it("handles category click (currently only All)", () => {
    render(
      <InvoicesFilters
        list={mockInvoices}
        setFilteredList={mockSetFilteredList}
      />
    );

    // The first "All" button is Category
    const categoryAllBtn = screen.getAllByRole("button", { name: "All" })[0];

    fireEvent.click(categoryAllBtn);

    // Should trigger filter update (no change effectively since it was already All)
    expect(mockSetFilteredList).toHaveBeenCalled();
    // Verify active style class
    expect(categoryAllBtn.className).toContain("bg-blue-light!");
  });
});
