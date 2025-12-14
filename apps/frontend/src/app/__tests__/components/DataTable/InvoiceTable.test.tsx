import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import InvoiceTable, {
  getStatusStyle,
} from "@/app/components/DataTable/InvoiceTable";
import { InvoiceProps } from "@/app/types/invoice";

// --- Mocks ---

// Mock Next.js Image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt || "mock-img"} />
  ),
}));

// Mock Icons
jest.mock("react-icons/io5", () => ({
  IoEye: () => <span data-testid="icon-eye">View</span>,
}));

// Mock InvoiceCard (Mobile View)
jest.mock("@/app/components/Cards/InvoiceCard", () => ({
  __esModule: true,
  default: ({ invoice, handleViewInvoice }: any) => (
    <div data-testid="mobile-card">
      <span data-testid="mobile-pet">{invoice.metadata.pet}</span>
      <button
        // Fixed: Use _id or id depending on what's available at runtime in the mock
        data-testid={`mobile-view-btn-${invoice._id || invoice.id}`}
        onClick={() => handleViewInvoice(invoice)}
      >
        View Mobile
      </button>
    </div>
  ),
}));

// IMPORTANT: Smart Mock for GenericTable
jest.mock("@/app/components/GenericTable/GenericTable", () => ({
  __esModule: true,
  default: ({ data, columns }: any) => (
    <table data-testid="generic-table">
      <thead>
        <tr>
          {columns.map((col: any) => (
            <th key={col.key}>{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row: any, rowIndex: number) => (
          <tr key={rowIndex} data-testid="table-row">
            {columns.map((col: any) => (
              <td key={col.key}>
                {col.render ? col.render(row) : row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

describe("InvoiceTable Component", () => {
  const mockSetActiveInvoice = jest.fn();
  const mockSetViewInvoice = jest.fn();

  // Fixed: Added _id to match InvoiceProps type (likely MongoDB style)
  // Kept id just in case logic falls back to it, but typed as 'any' to bypass strict checks if needed
  const mockData: InvoiceProps[] = [
    {
      _id: "inv-1",
      id: "inv-1",
      amount: 150,
      dueDate: "2023-11-01",
      issueDate: "2023-10-01",
      status: "Paid",
      subtotal: "100.00",
      tax: "10.00",
      total: "110.00",
      date: "Oct 01, 2023",
      time: "10:00 AM",
      metadata: {
        appointmentId: "appt-123",
        pet: "Fido",
        petImage: "/dog.png",
        parent: "John Doe",
        service: "Checkup",
      },
    } as any,
    {
      _id: "inv-2",
      id: "inv-2",
      amount: 200,
      dueDate: "2023-11-05",
      issueDate: "2023-10-05",
      status: "Draft",
      subtotal: "180.00",
      tax: "20.00",
      total: "200.00",
      date: "Oct 05, 2023",
      time: "11:00 AM",
      metadata: {
        appointmentId: "appt-456",
        pet: "Rex",
        petImage: "/dog2.png",
        parent: "Jane Smith",
        service: "Surgery",
      },
    } as any,
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering ---

  it("renders the desktop table with correct data", () => {
    render(
      <InvoiceTable
        filteredList={mockData}
        setActiveInvoice={mockSetActiveInvoice}
        setViewInvoice={mockSetViewInvoice}
      />
    );

    const table = screen.getByTestId("generic-table");
    const scope = within(table);

    // Headers
    expect(scope.getByText("Companion")).toBeInTheDocument();
    expect(scope.getByText("Appointment ID")).toBeInTheDocument();
    expect(scope.getByText("Sub-total")).toBeInTheDocument();
    expect(scope.getByText("Total")).toBeInTheDocument();

    // Row 1 (Fido)
    expect(scope.getByText("Fido")).toBeInTheDocument();
    expect(scope.getByText("John")).toBeInTheDocument();
    expect(scope.getByText("appt-123")).toBeInTheDocument();
    expect(scope.getByText("Checkup")).toBeInTheDocument();
    expect(scope.getByText("Oct 01, 2023")).toBeInTheDocument();
    expect(scope.getByText("10:00 AM")).toBeInTheDocument();
    expect(scope.getByText("$ 100.00")).toBeInTheDocument();
    expect(scope.getByText("$ 10.00")).toBeInTheDocument();
    expect(scope.getByText("$ 110.00")).toBeInTheDocument();
    expect(scope.getByText("Paid")).toBeInTheDocument();

    // Row 2 (Rex)
    expect(scope.getByText("Rex")).toBeInTheDocument();
    expect(scope.getByText("Draft")).toBeInTheDocument();
  });

  it("renders mobile cards correctly", () => {
    render(
      <InvoiceTable
        filteredList={mockData}
        setActiveInvoice={mockSetActiveInvoice}
        setViewInvoice={mockSetViewInvoice}
      />
    );

    const cards = screen.getAllByTestId("mobile-card");
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText("Fido")).toBeInTheDocument();
    expect(within(cards[1]).getByText("Rex")).toBeInTheDocument();
  });

  // --- 2. Interactions ---

  it("handles view invoice click (Desktop)", () => {
    render(
      <InvoiceTable
        filteredList={[mockData[0]]}
        setActiveInvoice={mockSetActiveInvoice}
        setViewInvoice={mockSetViewInvoice}
      />
    );

    const viewBtn = screen.getByTestId("icon-eye").closest("button");
    fireEvent.click(viewBtn!);

    expect(mockSetActiveInvoice).toHaveBeenCalledWith(mockData[0]);
    expect(mockSetViewInvoice).toHaveBeenCalledWith(true);
  });

  it("handles view invoice click (Mobile)", () => {
    render(
      <InvoiceTable
        filteredList={[mockData[0]]}
        setActiveInvoice={mockSetActiveInvoice}
        setViewInvoice={mockSetViewInvoice}
      />
    );

    // Fixed: Use _id for selector to match mock rendering logic logic
    // Using explicit cast to 'any' to safely access property if Typescript complains
    const id = (mockData[0] as any)._id || (mockData[0] as any).id;
    const mobileBtn = screen.getByTestId(`mobile-view-btn-${id}`);
    fireEvent.click(mobileBtn);

    expect(mockSetActiveInvoice).toHaveBeenCalledWith(mockData[0]);
    expect(mockSetViewInvoice).toHaveBeenCalledWith(true);
  });

  // --- 3. Status Styling Helper ---

  describe("getStatusStyle helper", () => {
    it("returns correct styles for 'draft'", () => {
      expect(getStatusStyle("draft")).toEqual({
        color: "#F68523",
        backgroundColor: "#FEF3E9",
      });
    });

    it("returns correct styles for 'open'", () => {
      expect(getStatusStyle("Open")).toEqual({
        color: "#247AED",
        backgroundColor: "#EAF3FF",
      });
    });

    it("returns correct styles for 'paid'", () => {
      expect(getStatusStyle("paid")).toEqual({
        color: "#54B492",
        backgroundColor: "#E6F4EF",
      });
    });

    it("returns correct styles for 'uncollectible'", () => {
      expect(getStatusStyle("uncollectible")).toEqual({
        color: "#EA3729",
        backgroundColor: "#FDEBEA",
      });
    });

    it("returns correct styles for 'deleted'", () => {
      expect(getStatusStyle("deleted")).toEqual({
        color: "#EA3729",
        backgroundColor: "#FDEBEA",
      });
    });

    it("returns correct styles for 'void'", () => {
      expect(getStatusStyle("void")).toEqual({
        color: "#302F2E",
        backgroundColor: "#EAEAEA",
      });
    });

    it("returns correct styles for 'all'", () => {
      expect(getStatusStyle("all")).toEqual({
        color: "#302F2E",
        backgroundColor: "#fff",
      });
    });

    it("returns default styles for unknown status", () => {
      expect(getStatusStyle("unknown")).toEqual({
        color: "#fff",
        backgroundColor: "#247AED",
      });
    });
  });
});
