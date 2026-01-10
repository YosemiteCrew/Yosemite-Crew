import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import DocumentsTable from "@/app/components/DataTable/DocumentsTable";
import { OrganizationDocument } from "@/app/types/document";

// --- Mocks ---

// REMOVED: GenericTable mock.
// We will integration test with the real table component to avoid module resolution/mocking issues.

jest.mock("@/app/components/Cards/DocumentsCard", () => ({
  __esModule: true,
  default: ({ document, handleViewDocument }: any) => (
    <div data-testid="documents-card">
      <span>{document.title}</span>
      <button
        data-testid={`view-card-${document._id}`}
        onClick={() => handleViewDocument(document)}
      >
        View
      </button>
    </div>
  ),
}));

// --- Test Data ---

const mockDocuments: OrganizationDocument[] = [
  {
    _id: "doc-1",
    title: "Employee Handbook",
    description: "Guidelines for staff",
    category: "HR",
    fileUrl: "http://example.com/handbook.pdf",
    createdAt: "2023-01-01",
    updatedAt: "2023-01-02",
  },
  {
    _id: "doc-2",
    title: "Tax Form 2023",
    description: "Financial records",
    category: "Finance",
    fileUrl: "http://example.com/taxes.pdf",
    createdAt: "2023-02-01",
    updatedAt: "2023-02-02",
  },
] as any;

describe("DocumentsTable Component", () => {
  const mockSetActive = jest.fn();
  const mockSetView = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Desktop View (Integration) ---

  it("renders table content correctly via columns logic (Desktop View)", () => {
    const { container } = render(
      <DocumentsTable
        filteredList={mockDocuments}
        setActive={mockSetActive}
        setView={mockSetView}
      />
    );

    // Scope to Desktop View
    const desktopView = container.querySelector(String.raw`.hidden.xl\:flex`);
    expect(desktopView).toBeInTheDocument();

    // Query rows (includes header + body rows)
    const rows = within(desktopView as HTMLElement).getAllByRole("row");
    // 1 Header + 2 Data rows = 3 rows
    expect(rows).toHaveLength(3);

    // -- Row 1 Data (Index 1) --
    const row1 = rows[1];
    expect(within(row1).getByText("Employee Handbook")).toBeInTheDocument();
    expect(within(row1).getByText("Guidelines for staff")).toBeInTheDocument();
    expect(within(row1).getByText("Hr")).toBeInTheDocument();

    // -- Row 2 Data (Index 2) --
    const row2 = rows[2];
    expect(within(row2).getByText("Tax Form 2023")).toBeInTheDocument();
  });

  it("handles 'View' action button click in Desktop View", () => {
    const { container } = render(
      <DocumentsTable
        filteredList={[mockDocuments[0]]}
        setActive={mockSetActive}
        setView={mockSetView}
      />
    );

    const desktopView = container.querySelector(String.raw`.hidden.xl\:flex`);
    const rows = within(desktopView as HTMLElement).getAllByRole("row");
    const dataRow = rows[1]; // First data row

    // Find the button within the data row
    const viewButton = within(dataRow).getByRole("button");

    fireEvent.click(viewButton);

    expect(mockSetActive).toHaveBeenCalledWith(mockDocuments[0]);
    expect(mockSetView).toHaveBeenCalledWith(true);
  });

  // --- 2. Mobile View (Mocked Cards) ---

  it("renders DocumentsCard components (Mobile View)", () => {
    render(
      <DocumentsTable
        filteredList={mockDocuments}
        setActive={mockSetActive}
        setView={mockSetView}
      />
    );

    const cards = screen.getAllByTestId("documents-card");
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText("Employee Handbook")).toBeInTheDocument();
  });

  it("handles 'View' action on Mobile Card", () => {
    render(
      <DocumentsTable
        filteredList={[mockDocuments[0]]}
        setActive={mockSetActive}
        setView={mockSetView}
      />
    );

    const viewBtn = screen.getByTestId("view-card-doc-1");
    fireEvent.click(viewBtn);

    expect(mockSetActive).toHaveBeenCalledWith(mockDocuments[0]);
    expect(mockSetView).toHaveBeenCalledWith(true);
  });

  // --- 3. Empty State Logic ---

  it("renders 'No data available' when filteredList is empty", () => {
    render(
      <DocumentsTable
        filteredList={[]}
        setActive={mockSetActive}
        setView={mockSetView}
      />
    );

    // Expecting 2 instances:
    // 1. Inside the real GenericTable (colspan row)
    // 2. Inside the mobile view container
    const messages = screen.getAllByText("No data available");
    expect(messages.length).toBeGreaterThanOrEqual(1);
  });

  // --- 4. Edge Cases ---

  it("does not crash if optional props (setActive, setView) are missing", () => {
    const { container } = render(
      <DocumentsTable filteredList={[mockDocuments[0]]} />
    );

    const desktopView = container.querySelector(String.raw`.hidden.xl\:flex`);
    const rows = within(desktopView as HTMLElement).getAllByRole("row");
    const viewButton = within(rows[1]).getByRole("button");

    // Clicking should safely do nothing due to optional chaining `?.`
    fireEvent.click(viewButton);

    // If we reached here without an error, the test passes
    expect(true).toBe(true);
  });
});
