import React from "react";
import { render, screen } from "@testing-library/react";
// Import Path: Go up 7 levels to 'src/app', then down to 'pages'
import DischargeSubmissions from "../../../../../../../pages/Appointments/Sections/AppointmentInfo/Prescription/Submissions/DischargeSubmissions";

// --- Mocks ---

// Mock Accordion to render children immediately
jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid="accordion">
      <div className="title">{title}</div>
      <div className="content">{children}</div>
    </div>
  ),
}));

// Mock the formsStore
jest.mock("@/app/stores/formsStore", () => ({
  useFormsStore: () => ({}),
}));

// Mock SignatureActions to simplify testing
jest.mock("../../../../../../../pages/Appointments/Sections/AppointmentInfo/Prescription/Submissions/SignatureActions", () => ({
  __esModule: true,
  default: () => <div data-testid="signature-actions" />,
}));

describe("DischargeSubmissions Component", () => {
  const setFormData = jest.fn();
  // --- Section 1: Empty States ---

  it("renders 'No submissions yet' when discharge list is empty", () => {
    const mockData = { discharge: [] };
    render(<DischargeSubmissions formData={mockData as any} setFormData={setFormData as any} />);

    expect(
      screen.getByText("Previous discharge submissions")
    ).toBeInTheDocument();
    expect(screen.getByText("No submissions yet.")).toBeInTheDocument();
  });

  it("renders 'No submissions yet' when discharge property is undefined", () => {
    // formData.discharge is undefined
    const mockData = {};
    render(<DischargeSubmissions formData={mockData as any} setFormData={setFormData as any} />);

    expect(screen.getByText("No submissions yet.")).toBeInTheDocument();
  });

  // --- Section 2: Populated Data (Happy Path) ---

  it("renders a list of submissions correctly", () => {
    const mockData = {
      discharge: [
        {
          _id: "sub-1",
          answers: {
            Instructions: "Rest well",
            "Follow-up": "In 2 weeks",
          },
          submittedAt: new Date(),
        },
      ],
    };

    render(<DischargeSubmissions formData={mockData as any} setFormData={setFormData as any} />);

    // Check Question Labels - humanizeKey converts "Follow-up" to "Follow Up"
    expect(screen.getByText("Instructions")).toBeInTheDocument();
    expect(screen.getByText("Follow Up")).toBeInTheDocument();

    // Check Answers
    expect(screen.getByText("Rest well")).toBeInTheDocument();
    expect(screen.getByText("In 2 weeks")).toBeInTheDocument();
  });

  // --- Section 3: Logic & Filtering (toStringPairs) ---

  it("filters out non-string values from display", () => {
    const mockData = {
      discharge: [
        {
          _id: "sub-mixed",
          answers: {
            "Valid Note": "Shown",
            "Hidden Number": 999, // Should be filtered out
            "Hidden Boolean": false, // Should be filtered out
          },
        },
      ],
    };

    render(<DischargeSubmissions formData={mockData as any} setFormData={setFormData as any} />);

    // Should be visible
    expect(screen.getByText("Valid Note")).toBeInTheDocument();
    expect(screen.getByText("Shown")).toBeInTheDocument();

    // Should NOT be visible (filtered by toStringPairs)
    expect(screen.queryByText("Hidden Number")).not.toBeInTheDocument();
    expect(screen.queryByText("999")).not.toBeInTheDocument();
  });

  it("does not render a submission card if it contains no valid string pairs", () => {
    const mockData = {
      discharge: [
        {
          _id: "sub-empty-pairs",
          answers: {
            "Only Number": 100,
          },
        },
      ],
    };

    render(<DischargeSubmissions formData={mockData as any} setFormData={setFormData as any} />);

    // The component maps the submission but returns null because pairs.length === 0.
    const accordion = screen.getByTestId("accordion");

    // We expect the title
    expect(accordion).toHaveTextContent("Previous discharge submissions");

    // We expect NO "Only Number" text
    expect(screen.queryByText("Only Number")).not.toBeInTheDocument();
  });

  // --- Section 4: Edge Cases (Null/Undefined Answers) ---

  it("handles null or undefined answers object gracefully", () => {
    const mockData = {
      discharge: [
        {
          _id: "sub-null-answers",
          answers: null, // Should fallback to {} and return empty pairs
        },
        {
          _id: "sub-undefined-answers",
          answers: undefined,
        },
      ],
    };

    render(<DischargeSubmissions formData={mockData as any} setFormData={setFormData as any} />);

    // Effectively rendering an empty list inside the accordion.
    expect(screen.getByTestId("accordion")).toBeInTheDocument();
    // Verify no content rendered
    expect(screen.queryByText("undefined")).not.toBeInTheDocument();
  });

  it("uses submittedAt as key if _id is missing", () => {
    const date = new Date("2025-01-01");
    const mockData = {
      discharge: [
        {
          // No _id
          submittedAt: date,
          answers: { Key: "Value" },
        },
      ],
    };

    render(<DischargeSubmissions formData={mockData as any} setFormData={setFormData as any} />);
    expect(screen.getByText("Value")).toBeInTheDocument();
  });
});
