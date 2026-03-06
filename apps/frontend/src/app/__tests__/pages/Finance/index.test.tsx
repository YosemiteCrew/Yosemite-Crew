import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import ProtectedFinance from "@/app/features/finance/pages/Finance";

const useInvoicesMock = jest.fn();
const useLoadInvoicesMock = jest.fn();
const useSearchStoreMock = jest.fn();
const invoiceTableSpy = jest.fn();

jest.mock("@/app/ui/layout/guards/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/ui/layout/guards/OrgGuard", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/hooks/useInvoices", () => ({
  useInvoicesForPrimaryOrg: () => useInvoicesMock(),
  useLoadInvoicesForPrimaryOrg: () => useLoadInvoicesMock(),
}));

jest.mock("@/app/stores/searchStore", () => ({
  useSearchStore: (selector: any) => useSearchStoreMock(selector),
}));

jest.mock("@/app/ui/layout/guards/PermissionGate", () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/ui/filters/Filters", () => () => (
  <div data-testid="filters" />
));

jest.mock("@/app/ui/tables/InvoiceTable", () => (props: any) => {
  invoiceTableSpy(props);
  return <div data-testid="invoice-table" />;
});

jest.mock("@/app/features/finance/pages/Finance/Sections/InvoiceInfo", () => () => (
  <div data-testid="invoice-info" />
));

describe("Finance page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLoadInvoicesMock.mockReturnValue(undefined);
    useInvoicesMock.mockReturnValue([
      { id: "inv-1", status: "paid", appointmentId: "appt-1" },
      { id: "inv-2", status: "pending", appointmentId: "appt-2" },
    ]);
    useSearchStoreMock.mockImplementation((selector: any) =>
      selector({ query: "appt-1" })
    );
  });

  it("renders filtered invoices and table", () => {
    render(<ProtectedFinance />);

    expect(screen.getByTestId("invoice-table")).toBeInTheDocument();
    expect(invoiceTableSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        filteredList: [expect.objectContaining({ id: "inv-1" })],
      })
    );
  });
});
