import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import InvoiceCard from "@/app/components/Cards/InvoiceCard";
import { Invoice } from "@yosemite-crew/types";

// --- Mocks ---

jest.mock("@/app/components/DataTable/InvoiceTable", () => ({
  getStatusStyle: jest.fn(() => ({ color: "green" })),
}));

jest.mock("@/app/utils/forms", () => ({
  formatDateLabel: jest.fn(() => "Jan 01, 2023"),
  formatTimeLabel: jest.fn(() => "10:00 AM"),
}));

import { formatDateLabel, formatTimeLabel } from "@/app/utils/forms";

// --- Test Data ---

const mockInvoice: Invoice = {
  id: "INV-1001",
  companionId: "Buddy",
  createdAt: "2023-01-01T10:00:00Z",
  subtotal: 100,
  taxTotal: 10,
  totalAmount: 110,
  status: "paid",
} as any;

describe("InvoiceCard Component", () => {
  const mockHandleView = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering Details ---

  it("renders invoice details correctly", () => {
    render(
      <InvoiceCard invoice={mockInvoice} handleViewInvoice={mockHandleView} />
    );

    // Companion ID (Title)
    expect(screen.getByText("Buddy")).toBeInTheDocument();

    // Appointment ID & Service
    expect(screen.getByText("Appointment ID:")).toBeInTheDocument();
    expect(screen.getAllByText("INV-1001").length).toBeGreaterThanOrEqual(1);

    // Date/Time
    expect(formatDateLabel).toHaveBeenCalledWith(mockInvoice.createdAt);
    expect(formatTimeLabel).toHaveBeenCalledWith(mockInvoice.createdAt);
    expect(screen.getByText("Jan 01, 2023 / 10:00 AM")).toBeInTheDocument();

    // Financials
    expect(screen.getByText("$ 100")).toBeInTheDocument(); // Subtotal
    expect(screen.getByText("$ 10")).toBeInTheDocument(); // Tax
    expect(screen.getByText("110")).toBeInTheDocument(); // Total
  });

  // --- 2. Fallback Logic ---

  it("handles missing optional fields with default '-'", () => {
    const emptyInvoice = {
      ...mockInvoice,
      companionId: null,
      id: null,
    } as any;

    render(
      <InvoiceCard invoice={emptyInvoice} handleViewInvoice={mockHandleView} />
    );

    const dashes = screen.getAllByText("-");
    expect(dashes.length).toBeGreaterThan(0);
  });

  // --- 3. Status Rendering ---

  it("capitalizes status and applies styles", () => {
    render(
      <InvoiceCard invoice={mockInvoice} handleViewInvoice={mockHandleView} />
    );

    // "paid" -> "Paid"
    const statusBadge = screen.getByText("Paid");
    expect(statusBadge).toBeInTheDocument();
    // JSDOM computes "green" to "rgb(0, 128, 0)"
    expect(statusBadge).toHaveStyle({ color: "rgb(0, 128, 0)" });
  });

  // --- 4. Interaction ---

  it("calls handleViewInvoice when View button is clicked", () => {
    render(
      <InvoiceCard invoice={mockInvoice} handleViewInvoice={mockHandleView} />
    );

    const viewBtn = screen.getByText("View");
    fireEvent.click(viewBtn);

    expect(mockHandleView).toHaveBeenCalledTimes(1);
    expect(mockHandleView).toHaveBeenCalledWith(mockInvoice);
  });
});
