import React from "react";
import { render, screen } from "@testing-library/react";
import Core from "@/app/components/CompanionInfo/Sections/Core";

// --- Mocks ---

// Mock EditableAccordion to capture and display props for verification
jest.mock("@/app/components/Accordion/EditableAccordion", () => {
  return jest.fn((props) => (
    <div data-testid="editable-accordion">
      <span data-testid="title">{props.title}</span>
      <span data-testid="data-json">{JSON.stringify(props.data)}</span>
      <span data-testid="fields-count">{props.fields?.length}</span>
    </div>
  ));
});

import EditableAccordion from "@/app/components/Accordion/EditableAccordion";

// --- Test Data ---

const mockCompanion = {
  breedDog: "Golden Retriever",
  weight: "30kg",
  color: "Golden",
};

describe("Core Section Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering Structure ---

  it("renders the main section header", () => {
    render(<Core companion={mockCompanion} />);

    // Check for the main title
    expect(screen.getByText("Core information")).toBeInTheDocument();
  });

  it("renders multiple EditableAccordion components", () => {
    render(<Core companion={mockCompanion} />);

    // Should be 2 accordions based on the provided code
    const accordions = screen.getAllByTestId("editable-accordion");
    expect(accordions).toHaveLength(2);
  });

  // --- 2. Data Passing ---

  it("passes the correct data object to accordions", () => {
    render(<Core companion={mockCompanion} />);

    // Get all data-json spans
    const dataSpans = screen.getAllByTestId("data-json");

    // Both accordions receive the same full companion object in this implementation
    dataSpans.forEach((span) => {
      expect(span).toHaveTextContent(JSON.stringify(mockCompanion));
    });
  });

  // --- 3. Configuration & Props ---

  it("configures the 'Breeding information' accordion correctly", () => {
    render(<Core companion={mockCompanion} />);

    // Find specific accordion by title text
    const breedingTitle = screen.getByText("Breeding information");
    expect(breedingTitle).toBeInTheDocument();

    // Verify fields prop (via mock calls)
    // Filter calls to find the one with title="Breeding information"
    const calls = (EditableAccordion as jest.Mock).mock.calls;
    const breedingCall = calls.find(
      (call) => call[0].title === "Breeding information"
    );

    expect(breedingCall).toBeDefined();
    // Check the fields array: [{ label: "Breed dog", key: "breedDog", type: "text" }]
    expect(breedingCall[0].fields).toEqual([
      { label: "Breed dog", key: "breedDog", type: "text" },
    ]);
  });

  it("configures the 'Physical information' accordion correctly", () => {
    render(<Core companion={mockCompanion} />);

    const physicalTitle = screen.getByText("Physical information");
    expect(physicalTitle).toBeInTheDocument();

    // Verify fields prop
    const calls = (EditableAccordion as jest.Mock).mock.calls;
    const physicalCall = calls.find(
      (call) => call[0].title === "Physical information"
    );

    expect(physicalCall).toBeDefined();
    // In the current code, Physical Info reuses BreedingFields constant
    expect(physicalCall[0].fields).toEqual([
      { label: "Breed dog", key: "breedDog", type: "text" },
    ]);
  });
});
