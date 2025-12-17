import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import DocumentsCard from "@/app/components/Cards/DocumentsCard";
import { OrganizationDocument } from "@/app/types/document";

// --- Test Data ---

const mockDocument: OrganizationDocument = {
  _id: "doc-1",
  title: "Policy Manual",
  description: "Company policies for 2023",
  category: "HR",
  fileUrl: "https://example.com/file.pdf",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} as any;

describe("DocumentsCard Component", () => {
  const mockHandleView = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering ---

  it("renders document details correctly", () => {
    render(
      <DocumentsCard
        document={mockDocument}
        handleViewDocument={mockHandleView}
      />
    );

    // Title
    expect(screen.getByText("Policy Manual")).toBeInTheDocument();

    // Description Label & Value
    expect(screen.getByText("Description:")).toBeInTheDocument();
    expect(screen.getByText("Company policies for 2023")).toBeInTheDocument();

    // Category Label & Value
    expect(screen.getByText("Category:")).toBeInTheDocument();
    expect(screen.getByText("HR")).toBeInTheDocument();
  });

  // --- 2. Interaction ---

  it("calls handleViewDocument when View button is clicked", () => {
    render(
      <DocumentsCard
        document={mockDocument}
        handleViewDocument={mockHandleView}
      />
    );

    const viewBtn = screen.getByText("View");
    fireEvent.click(viewBtn);

    expect(mockHandleView).toHaveBeenCalledTimes(1);
    expect(mockHandleView).toHaveBeenCalledWith(mockDocument);
  });
});
