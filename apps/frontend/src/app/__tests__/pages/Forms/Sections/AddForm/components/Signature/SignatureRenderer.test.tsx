import React from "react";
import { render, screen } from "@testing-library/react";
import SignatureRenderer from "../../../../../../../pages/Forms/Sections/AddForm/components/Signature/SignatureRenderer";
import { FormField } from "@/app/types/forms";

describe("SignatureRenderer Component", () => {
  // Strict mock object matching the required type
  const mockField = {
    id: "sig-123",
    type: "signature",
    label: "Client Signature",
  } as FormField;

  // --- Section 1: Rendering ---

  it("renders the label correctly", () => {
    render(<SignatureRenderer field={mockField} />);

    // Verify label text
    expect(screen.getByText("Client Signature")).toBeInTheDocument();
  });

  // --- Section 2: UI Structure & Classes ---

  it("renders the drawing area placeholder text", () => {
    render(<SignatureRenderer field={mockField} />);

    // Verify placeholder text
    expect(screen.getByText("Please Save and Sign")).toBeInTheDocument();
  });

  it("applies correct styling classes (dashed border)", () => {
    render(<SignatureRenderer field={mockField} />);

    const drawingArea = screen.getByText("Please Save and Sign");

    // Verify key styling classes that define the component's look
    expect(drawingArea).toHaveClass("border-dashed");
    expect(drawingArea).toHaveClass("h-[120px]");
    expect(drawingArea).toHaveClass("border-grey-light");
  });

  // --- Section 3: Edge Cases ---

  it("renders even if label is empty string", () => {
    const fieldEmptyLabel = { ...mockField, label: "" } as any;

    render(<SignatureRenderer field={fieldEmptyLabel} />);

    // Should still see the drawing area
    expect(screen.getByText("Please Save and Sign")).toBeInTheDocument();
  });
});
