import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Finance from "@/app/pages/Finance";
import { Invoice } from "@yosemite-crew/types";

jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/components/OrgGuard", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

const useInvoicesMock = jest.fn();

jest.mock("@/app/hooks/useInvoices", () => ({
  useInvoicesForPrimaryOrg: () => useInvoicesMock(),
  useLoadInvoicesForPrimaryOrg: jest.fn(),
}));

jest.mock("@/app/stores/searchStore", () => ({
  useSearchStore: (selector: any) => selector({ query: "" }),
}));

const filtersSpy = jest.fn();

jest.mock("@/app/components/Filters/Filters", () => ({
  __esModule: true,
  default: (props: any) => {
    filtersSpy(props);
    return (
      <button type="button" onClick={() => props.setActiveStatus("paid")}
        >
        SetPaid
      </button>
    );
  },
}));

const invoiceTableSpy = jest.fn();

jest.mock("@/app/components/DataTable/InvoiceTable", () => ({
  __esModule: true,
  default: (props: any) => {
    invoiceTableSpy(props);
    return <div data-testid="invoice-table" />;
  },
}));

jest.mock("@/app/pages/Finance/Sections/InvoiceInfo", () => ({
  __esModule: true,
  default: () => <div data-testid="invoice-info" />,
}));

describe("Finance page", () => {
  const invoices: Invoice[] = [
    { id: "inv-1", status: "PAID", appointmentId: "A-100" } as Invoice,
    { id: "inv-2", status: "PENDING", appointmentId: "B-200" } as Invoice,
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    useInvoicesMock.mockReturnValue(invoices);
  });

  it("renders invoice count and filters status", () => {
    render(<Finance />);

    expect(screen.getByText(/Finance/)).toBeInTheDocument();
    expect(screen.getByText("(2)")).toBeInTheDocument();

    expect(invoiceTableSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        filteredList: invoices,
      })
    );

    fireEvent.click(screen.getByText("SetPaid"));

    expect(invoiceTableSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        filteredList: [invoices[0]],
      })
    );
  });
});
