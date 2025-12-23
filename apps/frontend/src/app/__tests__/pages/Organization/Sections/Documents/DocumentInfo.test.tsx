import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DocumentInfo from "@/app/pages/Organization/Sections/Documents/DocumentInfo";
import { updateDocument } from "@/app/services/documentService";
import { OrganizationDocument } from "@/app/types/document";

// --- Mocks ---

jest.mock("@/app/services/documentService", () => ({
  updateDocument: jest.fn(),
}));

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ children, showModal }: any) =>
    showModal ? <div>{children}</div> : null,
}));

jest.mock("@/app/components/Accordion/EditableAccordion", () => ({
  __esModule: true,
  default: ({ title, data, onSave }: any) => (
    <div data-testid="editable-accordion">
      <h3>{title}</h3>
      <span>{data.title}</span>
      <button
        onClick={() =>
          onSave({
            title: "Updated Title",
            description: "New Desc",
            category: "GENERAL",
          })
        }
      >
        Save Meta
      </button>
    </div>
  ),
}));

// Mock DocUploader to simulate successful upload callback
jest.mock("@/app/components/UploadImage/DocUploader", () => ({
  __esModule: true,
  default: ({ onChange }: any) => (
    <div>
      <button onClick={() => onChange("https://new-file.url")}>
        Simulate Upload
      </button>
    </div>
  ),
}));

jest.mock("@/app/components/Buttons", () => ({
  Secondary: ({ text, onClick }: any) => (
    <button onClick={onClick}>{text}</button>
  ),
  Primary: ({ text, onClick }: any) => (
    <button onClick={onClick}>{text}</button>
  ),
}));

describe("DocumentInfo Component", () => {
  const mockSetShowModal = jest.fn();
  const mockDocument: OrganizationDocument = {
    _id: "doc-123",
    organisationId: "org-1",
    title: "Policy Doc",
    description: "Original Description",
    fileUrl: "https://old-file.url",
    category: "PRIVACY_POLICY",
  };

  // Mock window.open
  const originalOpen = window.open;
  beforeAll(() => {
    window.open = jest.fn();
  });
  afterAll(() => {
    window.open = originalOpen;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering Section ---

  it("renders correctly with document details", () => {
    render(
      <DocumentInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeDocument={mockDocument}
      />
    );

    expect(screen.getByText("View document")).toBeInTheDocument();
    expect(screen.getByText("Document info")).toBeInTheDocument();
    expect(screen.getByText("Policy Doc")).toBeInTheDocument(); // From mock accordion
    expect(screen.getByText("Download document")).toBeInTheDocument();
  });

  it("closes modal when close icon is clicked", () => {
    const { container } = render(
      <DocumentInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeDocument={mockDocument}
      />
    );

    const closeIcon = container.querySelector("svg.cursor-pointer");
    if (closeIcon) fireEvent.click(closeIcon);

    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });

  // --- 2. Interaction: Download ---

  it("opens the file URL in a new tab when Download is clicked", () => {
    render(
      <DocumentInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeDocument={mockDocument}
      />
    );

    fireEvent.click(screen.getByText("Download document"));
    expect(window.open).toHaveBeenCalledWith("https://old-file.url", "_blank");
  });

  // --- 3. Interaction: Update Metadata ---

  it("updates document metadata via EditableAccordion save", async () => {
    (updateDocument as jest.Mock).mockResolvedValueOnce({ success: true });

    render(
      <DocumentInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeDocument={mockDocument}
      />
    );

    fireEvent.click(screen.getByText("Save Meta"));

    await waitFor(() => {
      expect(updateDocument).toHaveBeenCalledWith({
        _id: "doc-123",
        organisationId: "org-1",
        fileUrl: "https://old-file.url", // Should preserve old URL
        title: "Updated Title",
        description: "New Desc",
        category: "GENERAL",
      });
      expect(mockSetShowModal).toHaveBeenCalledWith(false);
    });
  });

  it("logs error if metadata update fails", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();
    (updateDocument as jest.Mock).mockRejectedValueOnce(
      new Error("Update failed")
    );

    render(
      <DocumentInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeDocument={mockDocument}
      />
    );

    fireEvent.click(screen.getByText("Save Meta"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
    });
    consoleSpy.mockRestore();
  });

  // --- 4. Interaction: Update File ---

  it("shows Save button only after a new file is uploaded", () => {
    render(
      <DocumentInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeDocument={mockDocument}
      />
    );

    // Initially "Save" (Primary button) should not be visible because fileUrl state is empty
    // Note: The "Save Meta" button is part of the mock accordion, not the Primary button
    expect(screen.queryByText("Save")).not.toBeInTheDocument();

    // Simulate upload
    fireEvent.click(screen.getByText("Simulate Upload"));

    // Now Save button should appear
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("updates document file URL when Save is clicked after upload", async () => {
    (updateDocument as jest.Mock).mockResolvedValueOnce({ success: true });

    render(
      <DocumentInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeDocument={mockDocument}
      />
    );

    // 1. Upload new file
    fireEvent.click(screen.getByText("Simulate Upload"));

    // 2. Click Save (Primary button)
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(updateDocument).toHaveBeenCalledWith({
        ...mockDocument,
        fileUrl: "https://new-file.url",
      });
      expect(mockSetShowModal).toHaveBeenCalledWith(false);
    });
  });

  it("logs error if file update fails", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();
    (updateDocument as jest.Mock).mockRejectedValueOnce(
      new Error("File Update failed")
    );

    render(
      <DocumentInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeDocument={mockDocument}
      />
    );

    fireEvent.click(screen.getByText("Simulate Upload"));
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
    });
    consoleSpy.mockRestore();
  });
});
