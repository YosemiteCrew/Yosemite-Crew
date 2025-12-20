import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Documents from "@/app/pages/Organization/Sections/Documents/Documents";
import { useDocumentsForPrimaryOrg } from "@/app/hooks/useDocuments";

// --- Mocks ---

jest.mock("@/app/hooks/useDocuments", () => ({
  useDocumentsForPrimaryOrg: jest.fn(),
}));

jest.mock("@/app/components/Accordion/AccordionButton", () => ({
  __esModule: true,
  default: ({ title, buttonTitle, buttonClick, children }: any) => (
    <div data-testid="accordion-button">
      <h1>{title}</h1>
      <button onClick={() => buttonClick(true)}>{buttonTitle}</button>
      {children}
    </div>
  ),
}));

jest.mock("@/app/components/DataTable/DocumentsTable", () => ({
  __esModule: true,
  default: ({ filteredList, setActive, setView }: any) => (
    <div data-testid="documents-table">
      {filteredList.map((doc: any) => (
        <button
          key={doc._id}
          data-testid={`view-doc-${doc._id}`}
          onClick={() => {
            setActive(doc);
            setView(true);
          }}
        >
          View {doc.title}
        </button>
      ))}
    </div>
  ),
}));

jest.mock(
  "../../../../../pages/Organization/Sections/Documents/AddDocument",
  () => ({
    __esModule: true,
    default: ({ showModal }: any) =>
      showModal ? <div data-testid="add-doc-modal" /> : null,
  })
);

jest.mock(
  "../../../../../pages/Organization/Sections/Documents/DocumentInfo",
  () => ({
    __esModule: true,
    default: ({ showModal, activeDocument }: any) =>
      showModal ? (
        <div data-testid="doc-info-modal">{activeDocument.title}</div>
      ) : null,
  })
);

describe("Documents Section Component", () => {
  const mockDocuments = [
    { _id: "doc-1", title: "Privacy Policy" },
    { _id: "doc-2", title: "Terms of Service" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering Section ---

  it("renders correctly with a list of documents", () => {
    (useDocumentsForPrimaryOrg as jest.Mock).mockReturnValue(mockDocuments);
    render(<Documents />);

    expect(screen.getByText("Company documents")).toBeInTheDocument();
    expect(screen.getByTestId("documents-table")).toBeInTheDocument();
    expect(screen.getByText("View Privacy Policy")).toBeInTheDocument();
  });

  it("handles empty document list state", () => {
    (useDocumentsForPrimaryOrg as jest.Mock).mockReturnValue([]);
    render(<Documents />);

    // Info modal should not render if no active document
    expect(screen.queryByTestId("doc-info-modal")).not.toBeInTheDocument();
  });

  // --- 2. Interaction Section ---

  it("opens the AddDocument modal when 'Add' button is clicked", () => {
    (useDocumentsForPrimaryOrg as jest.Mock).mockReturnValue(mockDocuments);
    render(<Documents />);

    fireEvent.click(screen.getByText("Add"));
    expect(screen.getByTestId("add-doc-modal")).toBeInTheDocument();
  });

  it("opens the DocumentInfo modal and sets the correct active document", () => {
    (useDocumentsForPrimaryOrg as jest.Mock).mockReturnValue(mockDocuments);
    render(<Documents />);

    fireEvent.click(screen.getByTestId("view-doc-doc-2"));
    expect(screen.getByTestId("doc-info-modal")).toHaveTextContent(
      "Terms of Service"
    );
  });

  // --- 3. Logic & useEffect Section ---

  it("updates activeDocument if it exists in the new list after an update", () => {
    const { rerender } = render(<Documents />);

    // Initial render
    (useDocumentsForPrimaryOrg as jest.Mock).mockReturnValue(mockDocuments);
    rerender(<Documents />);

    // Simulate an edit: Doc 1 title changes
    const updatedDocs = [
      { _id: "doc-1", title: "Privacy Policy V2" },
      { _id: "doc-2", title: "Terms of Service" },
    ];
    (useDocumentsForPrimaryOrg as jest.Mock).mockReturnValue(updatedDocs);

    rerender(<Documents />);

    // Check if the active document (which defaults to index 0) updated its title
    fireEvent.click(screen.getByTestId("view-doc-doc-1")); // Ensure modal is open
    expect(screen.getByTestId("doc-info-modal")).toHaveTextContent(
      "Privacy Policy V2"
    );
  });

  it("resets activeDocument to the first item if the current active one is removed", () => {
    (useDocumentsForPrimaryOrg as jest.Mock).mockReturnValue(mockDocuments);
    const { rerender } = render(<Documents />);

    // Set Doc 2 as active
    fireEvent.click(screen.getByTestId("view-doc-doc-2"));
    expect(screen.getByTestId("doc-info-modal")).toHaveTextContent(
      "Terms of Service"
    );

    // Remove Doc 2 from the list
    const listAfterDeletion = [{ _id: "doc-1", title: "Privacy Policy" }];
    (useDocumentsForPrimaryOrg as jest.Mock).mockReturnValue(listAfterDeletion);

    rerender(<Documents />);

    // Should have defaulted back to Doc 1 (index 0)
    expect(screen.getByTestId("doc-info-modal")).toHaveTextContent(
      "Privacy Policy"
    );
  });

  it("sets activeDocument to null if the list becomes empty", () => {
    (useDocumentsForPrimaryOrg as jest.Mock).mockReturnValue(mockDocuments);
    const { rerender } = render(<Documents />);

    // Clear list
    (useDocumentsForPrimaryOrg as jest.Mock).mockReturnValue([]);
    rerender(<Documents />);

    expect(screen.queryByTestId("doc-info-modal")).not.toBeInTheDocument();
  });
});
