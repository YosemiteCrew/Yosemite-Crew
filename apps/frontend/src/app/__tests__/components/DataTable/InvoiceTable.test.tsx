import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import InvoiceTable, {
  getStatusStyle,
} from "@/app/components/DataTable/InvoiceTable";
import { Invoice } from "@yosemite-crew/types";

jest.mock("@/app/components/GenericTable/GenericTable", () => ({
  __esModule: true,
  default: ({ data, columns }: any) => (
    <div data-testid="generic-table">
      {data.map((item: any, idx: number) => (
        <div key={item.id+idx} data-testid="row">
          {columns.map((col: any) => (
            <div key={col.key} data-testid={`cell-${col.key}`}>
              {col.render ? col.render(item) : item[col.key]}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

jest.mock("@/app/components/Cards/InvoiceCard", () => ({
  __esModule: true,
  default: ({ invoice }: any) => (
    <div data-testid="invoice-card">{invoice.id}</div>
  ),
}));

jest.mock("react-icons/io5", () => ({
  IoEye: () => <span data-testid="eye-icon" />,
}));

jest.mock("@/app/utils/forms", () => ({
  formatDateLabel: () => "Jan 1",
  formatTimeLabel: () => "10:00 AM",
}));

describe("InvoiceTable", () => {
  const invoice: Invoice = {
    id: "inv-1",
    companionId: "comp-1",
    appointmentId: "appt-1",
    createdAt: new Date(),
    subtotal: 10,
    taxTotal: 2,
    totalAmount: 12,
    status: "PENDING",
    items: [],
    currency: "AED",
    updatedAt: new Date()
  } as Invoice;

  it("renders columns and handles view action", () => {
    const setActiveInvoice = jest.fn();
    const setViewInvoice = jest.fn();

    render(
      <InvoiceTable
        filteredList={[invoice]}
        setActiveInvoice={setActiveInvoice}
        setViewInvoice={setViewInvoice}
      />
    );

    fireEvent.click(screen.getByTestId("eye-icon").closest("button")!);

    expect(setActiveInvoice).toHaveBeenCalledWith(invoice);
    expect(setViewInvoice).toHaveBeenCalledWith(true);
  });

  it("returns styles for known status", () => {
    expect(getStatusStyle("pending")).toEqual({
      color: "#fff",
      backgroundColor: "#747283",
    });
  });
});
