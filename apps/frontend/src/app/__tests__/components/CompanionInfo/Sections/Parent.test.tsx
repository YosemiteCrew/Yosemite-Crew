import React from "react";
import { render, screen } from "@testing-library/react";
import Parent from "@/app/components/CompanionInfo/Sections/Parent";
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
  },
  parent: {
    _id: "p1",
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    phoneNumber: "123-456-7890",
  },
} as any;

describe("Parent Section Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering Structure ---

  it("renders the main section header", () => {
    render(<Parent companion={mockCompanion} />);

    expect(screen.getAllByText("Parent information").length).toBeGreaterThan(0);
  });

  it("renders the EditableAccordion component", () => {
    render(<Parent companion={mockCompanion} />);

    expect(screen.getByTestId("editable-accordion")).toBeInTheDocument();
  });

  // --- 2. Data Passing ---

  it("passes correct parent data to EditableAccordion", () => {
    render(<Parent companion={mockCompanion} />);

    const dataJson = screen.getByTestId("data-json").textContent;

    // FIX: Use null coalescing (??) to satisfy TS (no null) and SonarQube (no !)
    const parsedData = JSON.parse(dataJson ?? "{}");

    expect(parsedData).toEqual(
      expect.objectContaining({
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        phoneNumber: "123-456-7890",
      })
    );
  });

  // --- 3. Configuration & Props ---

  it("passes the correct configuration fields", () => {
    render(<Parent companion={mockCompanion} />);

    const passedProps = (EditableAccordion as jest.Mock).mock.calls[0][0];
    const fields = passedProps.fields;

    expect(fields).toHaveLength(4);
    expect(fields).toEqual([
      { label: "First name", key: "firstName", type: "text", required: true },
      { label: "Last name", key: "lastName", type: "text", required: true },
      { label: "Email", key: "email", type: "email", editable: false },
      { label: "Phone number", key: "phoneNumber", type: "tel", editable: false },
    ]);
  });

  it("sets correct display flags (defaultOpen, showEditIcon)", () => {
    render(<Parent companion={mockCompanion} />);

    expect(screen.getByTestId("default-open")).toHaveTextContent("true");
    expect(screen.getByTestId("show-edit")).toHaveTextContent("false");
  });
});
