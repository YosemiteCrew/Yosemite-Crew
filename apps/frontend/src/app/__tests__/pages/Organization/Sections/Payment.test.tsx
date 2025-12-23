import React from "react";
import { render, screen } from "@testing-library/react";
import Payment from "@/app/pages/Organization/Sections/Payment";
import { useInvoicesForPrimaryOrg } from "@/app/hooks/useInvoices";

// --- Mocks ---

// Mock external hook
jest.mock("@/app/hooks/useInvoices", () => ({
  useInvoicesForPrimaryOrg: jest.fn(),
}));

// Mock Sub-components to verify correct prop passing
jest.mock("@/app/components/Accordion/AccordionButton", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid="accordion-button">
      <h2>{title}</h2>
      {children}
    </div>
  ),
}));

jest.mock("@/app/components/Accordion/SmallAccordionButton", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid="small-accordion-button">
      <h3>{title}</h3>
      {children}
    </div>
  ),
}));

jest.mock("@/app/components/DataTable/InvoiceTable", () => ({
  __esModule: true,
  default: ({ filteredList }: any) => (
    <div data-testid="invoice-table">Count: {filteredList?.length || 0}</div>
  ),
}));

jest.mock("../../../../pages/Organization/Sections/ProfileCard", () => ({
  __esModule: true,
  default: ({ title, org }: any) => (
    <div data-testid={`profile-card-${title.toLowerCase().replace(" ", "-")}`}>
      <span>{title}</span>
      <span>{org.plan || org.email}</span>
    </div>
  ),
}));

describe("Payment Section Component", () => {
  const mockInvoices = [
    { id: "1", amount: 100, date: "2023-01-01" },
    { id: "2", amount: 200, date: "2023-02-01" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering ---

  it("renders the main Payment accordion", () => {
    (useInvoicesForPrimaryOrg as jest.Mock).mockReturnValue([]);
    render(<Payment />);

    expect(screen.getByTestId("accordion-button")).toBeInTheDocument();
    expect(screen.getByText("Payment")).toBeInTheDocument();
  });

  // --- 2. Data Mapping (Plan Overview) ---

  it("renders the Plan Overview card with hardcoded data", () => {
    (useInvoicesForPrimaryOrg as jest.Mock).mockReturnValue([]);
    render(<Payment />);

    const planCard = screen.getByTestId("profile-card-plan-overview");
    expect(planCard).toBeInTheDocument();
    expect(planCard).toHaveTextContent("Free");
  });

  // --- 3. Data Mapping (Billing Details) ---

  it("renders the Billing Details card with hardcoded data", () => {
    (useInvoicesForPrimaryOrg as jest.Mock).mockReturnValue([]);
    render(<Payment />);

    const billingCard = screen.getByTestId("profile-card-billing-details");
    expect(billingCard).toBeInTheDocument();
    expect(billingCard).toHaveTextContent("suryansh@yosemitecrew.com");
  });

  // --- 4. Integration (Invoices Table) ---

  it("fetches invoices and passes them to the InvoiceDataTable", () => {
    (useInvoicesForPrimaryOrg as jest.Mock).mockReturnValue(mockInvoices);
    render(<Payment />);

    expect(screen.getByTestId("small-accordion-button")).toHaveTextContent(
      "Invoices"
    );
    const table = screen.getByTestId("invoice-table");
    expect(table).toBeInTheDocument();
    expect(table).toHaveTextContent("Count: 2");
  });

  it("handles empty invoice list gracefully", () => {
    (useInvoicesForPrimaryOrg as jest.Mock).mockReturnValue(null);
    render(<Payment />);

    const table = screen.getByTestId("invoice-table");
    expect(table).toHaveTextContent("Count: 0");
  });
});
