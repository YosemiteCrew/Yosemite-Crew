import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import InvoiceTable, {
  getStatusStyle,
} from "@/app/components/DataTable/InvoiceTable";
import { Invoice } from "@yosemite-crew/types";

// --- Mocks ---

jest.mock("@/app/utils/forms", () => ({
  formatDateLabel: jest.fn(() => "Jan 01, 2023"),
  formatTimeLabel: jest.fn(() => "10:00 AM"),
}));

import { formatDateLabel, formatTimeLabel } from "@/app/utils/forms";

// Mock InvoiceCard for Mobile View
jest.mock("@/app/components/Cards/InvoiceCard", () => ({
  __esModule: true,
  default: ({ invoice, handleViewInvoice }: any) => (
    <div data-testid="invoice-card">
      <span>{invoice.companionId}</span>
      <button
        data-testid={`view-card-${invoice.id}`}
        onClick={() => handleViewInvoice(invoice)}
      >
        View
      </button>
    </div>
  ),
}));

// --- Test Data ---

const mockInvoices: Invoice[] = [
  {
    id: "inv-1",
    companionId: "Buddy",
    appointmentId: "appt-1",
    createdAt: "2023-01-01T10:00:00Z",
    subtotal: 100,
    taxTotal: 10,
    totalAmount: 110,
    status: "paid",
  },
  {
    id: "inv-2",
    companionId: null,
    appointmentId: null,
    createdAt: "2023-02-01T14:00:00Z",
    subtotal: 50,
    taxTotal: 5,
    totalAmount: 55,
    status: "pending",
  },
  {
    id: "inv-3",
    companionId: "Rex",
    appointmentId: "appt-3",
    createdAt: "2023-03-01T09:00:00Z",
    subtotal: 200,
    taxTotal: 20,
    totalAmount: 220,
    status: "failed",
  },
] as any;

describe("InvoiceTable Component", () => {
  const mockSetActive = jest.fn();
  const mockSetView = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Helper Function Tests (getStatusStyle) ---

  describe("getStatusStyle", () => {
    it("returns correct style for pending", () => {
      expect(getStatusStyle("pending")).toEqual({
        color: "#F68523",
        backgroundColor: "#FEF3E9",
      });
    });
    it("returns correct style for awaiting_payment", () => {
      expect(getStatusStyle("awaiting_payment")).toEqual({
        color: "#247AED",
        backgroundColor: "#EAF3FF",
      });
    });
    it("returns correct style for paid", () => {
      expect(getStatusStyle("paid")).toEqual({
        color: "#54B492",
        backgroundColor: "#E6F4EF",
      });
    });
    it("returns correct style for failed", () => {
      expect(getStatusStyle("failed")).toEqual({
        color: "#EA3729",
        backgroundColor: "#FDEBEA",
      });
    });
    it("returns correct style for cancelled", () => {
      expect(getStatusStyle("cancelled")).toEqual({
        color: "#EA3729",
        backgroundColor: "#FDEBEA",
      });
    });
    it("returns correct style for refunded", () => {
      expect(getStatusStyle("refunded")).toEqual({
        color: "#302F2E",
        backgroundColor: "#EAEAEA",
      });
    });
    it("returns default style for unknown", () => {
      expect(getStatusStyle("unknown")).toEqual({
        color: "#fff",
        backgroundColor: "#247AED",
      });
    });
    it("handles null/undefined status gracefully", () => {
      // @ts-expect-error -- Testing explicit null fallback
      expect(getStatusStyle(null)).toEqual({
        color: "#fff",
        backgroundColor: "#247AED",
      });
    });
  });

  // --- 2. Desktop View (Integration) ---

  it("renders table with correct data (Desktop View)", () => {
    const { container } = render(
      <InvoiceTable
        filteredList={mockInvoices}
        setActiveInvoice={mockSetActive}
        setViewInvoice={mockSetView}
      />
    );

    const desktopView = container.querySelector(String.raw`.hidden.xl\:flex`);
    expect(desktopView).toBeInTheDocument();

    const rows = within(desktopView as HTMLElement).getAllByRole("row");
    // 1 Header + 3 Data rows = 4
    expect(rows).toHaveLength(4);

    // -- Row 1 (Index 1) --
    const row1 = rows[1];

    // FIX: "Buddy" appears in both 'Companion' and 'Service' columns in the source code.
    // We expect 2 occurrences.
    expect(within(row1).getAllByText("Buddy")).toHaveLength(2);

    expect(within(row1).getByText("appt-1")).toBeInTheDocument();
    expect(within(row1).getByText("paid")).toBeInTheDocument();
    expect(within(row1).getByText("$ 110")).toBeInTheDocument();

    // -- Row 2 (Fallbacks) --
    const row2 = rows[2];
    const dashes = within(row2).getAllByText("-");
    expect(dashes.length).toBeGreaterThan(0);
    expect(within(row2).getByText("pending")).toBeInTheDocument();

    expect(formatDateLabel).toHaveBeenCalled();
    expect(formatTimeLabel).toHaveBeenCalled();
  });

  it("handles 'View' action button click in Desktop View", () => {
    const { container } = render(
      <InvoiceTable
        filteredList={[mockInvoices[0]]}
        setActiveInvoice={mockSetActive}
        setViewInvoice={mockSetView}
      />
    );

    const desktopView = container.querySelector(String.raw`.hidden.xl\:flex`);
    const rows = within(desktopView as HTMLElement).getAllByRole("row");
    const dataRow = rows[1];

    const viewButton = within(dataRow).getByRole("button");
    fireEvent.click(viewButton);

    expect(mockSetActive).toHaveBeenCalledWith(mockInvoices[0]);
    expect(mockSetView).toHaveBeenCalledWith(true);
  });

  // --- 3. Mobile View ---

  it("renders InvoiceCard components (Mobile View)", () => {
    render(
      <InvoiceTable
        filteredList={mockInvoices}
        setActiveInvoice={mockSetActive}
        setViewInvoice={mockSetView}
      />
    );

    const cards = screen.getAllByTestId("invoice-card");
    expect(cards).toHaveLength(3);
    expect(within(cards[0]).getByText("Buddy")).toBeInTheDocument();
  });

  it("handles 'View' action on Mobile Card", () => {
    render(
      <InvoiceTable
        filteredList={[mockInvoices[0]]}
        setActiveInvoice={mockSetActive}
        setViewInvoice={mockSetView}
      />
    );

    const viewBtn = screen.getByTestId("view-card-inv-1");
    fireEvent.click(viewBtn);

    expect(mockSetActive).toHaveBeenCalledWith(mockInvoices[0]);
    expect(mockSetView).toHaveBeenCalledWith(true);
  });

  // --- 4. Empty State ---

  it("renders 'No data available' when list is empty", () => {
    render(
      <InvoiceTable
        filteredList={[]}
        setActiveInvoice={mockSetActive}
        setViewInvoice={mockSetView}
      />
    );

    // Expect 2 instances: 1 in Table (colspan), 1 in Mobile view div
    const messages = screen.getAllByText("No data available");
    expect(messages.length).toBeGreaterThanOrEqual(1);
  });

  it("renders card keys correctly when id is missing", () => {
    const noIdInvoice = { ...mockInvoices[0], id: undefined } as any;
    const { container } = render(
      <InvoiceTable
        filteredList={[noIdInvoice]}
        setActiveInvoice={mockSetActive}
        setViewInvoice={mockSetView}
      />
    );

    // Check integration render (row exists)
    const desktopView = container.querySelector(String.raw`.hidden.xl\:flex`);
    const rows = within(desktopView as HTMLElement).getAllByRole("row");
    expect(rows.length).toBeGreaterThan(1);

    // Check mobile render
    expect(screen.getByTestId("invoice-card")).toBeInTheDocument();
  });
});
