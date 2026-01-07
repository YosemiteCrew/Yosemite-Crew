import React from "react";
import { render, screen } from "@testing-library/react";
import Companion from "@/app/components/CompanionInfo/Sections/Companion";
import { CompanionParent } from "@/app/pages/Companions/types";

// --- Mocks ---

jest.mock("@/app/components/Accordion/EditableAccordion", () => {
  return jest.fn((props) => (
    <div data-testid="editable-accordion">
      <span data-testid="title">{props.title}</span>
      <span data-testid="data-json">{JSON.stringify(props.data)}</span>
      <span data-testid="fields-count">{props.fields?.length}</span>
      <span data-testid="default-open">{props.defaultOpen?.toString()}</span>
      <span data-testid="show-edit">{props.showEditIcon?.toString()}</span>
    </div>
  ));
});

import EditableAccordion from "@/app/components/Accordion/EditableAccordion";

// --- Test Data ---

const mockCompanion: CompanionParent = {
  companion: {
    _id: "c1",
    name: "Rex",
    dateOfBirth: "2020-01-01",
    gender: "Male",
    colour: "Brown",
    insurance: {
      companyName: "PetSafe",
      policyNumber: "POL-123",
    },
  },
  parent: {
    firstName: "John",
  },
} as any;

describe("Companion Section Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering Structure ---

  it("renders the main section header", () => {
    render(<Companion companion={mockCompanion} />);

    expect(screen.getAllByText("Companion information").length).toBeGreaterThan(
      0
    );
  });

  it("renders the EditableAccordion component", () => {
    render(<Companion companion={mockCompanion} />);

    expect(screen.getByTestId("editable-accordion")).toBeInTheDocument();
  });

  // --- 2. Data Logic (Flattening) ---

  it("flattens companion and insurance data into a single data object", () => {
    render(<Companion companion={mockCompanion} />);

    const dataJson = screen.getByTestId("data-json").textContent;

    // FIX: Use null coalescing (??) to satisfy TS (no null) and SonarQube (no !)
    const parsedData = JSON.parse(dataJson ?? "{}");

    expect(parsedData).toHaveProperty("name", "Rex");
    expect(parsedData).toHaveProperty("gender", "Male");
    expect(parsedData).toHaveProperty("companyName", "PetSafe");
    expect(parsedData).toHaveProperty("policyNumber", "POL-123");
  });

  // --- 3. Configuration & Props ---

  it("passes the correct configuration fields to EditableAccordion", () => {
    render(<Companion companion={mockCompanion} />);

    const passedProps = (EditableAccordion as jest.Mock).mock.calls[0][0];
    const fields = passedProps.fields;

    expect(screen.getByTestId("fields-count")).toHaveTextContent("13");

    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Date of birth", key: "dateOfBirth" }),
        expect.objectContaining({
          label: "Insurance policy",
          key: "companyName",
        }),
        expect.objectContaining({
          label: "Gender",
          options: expect.arrayContaining(["Male"]),
        }),
      ])
    );
  });

  it("sets correct display flags (defaultOpen, showEditIcon)", () => {
    render(<Companion companion={mockCompanion} />);

    expect(screen.getByTestId("default-open")).toHaveTextContent("true");
    expect(screen.getByTestId("show-edit")).toHaveTextContent("false");
  });
});
