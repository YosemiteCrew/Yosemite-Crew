import React from "react";
import { render, screen } from "@testing-library/react";
// Import Path: Go up 7 levels to 'src/app', then down to 'pages'
import SubjectiveSubmissions from "../../../../../../../pages/Appointments/Sections/AppointmentInfo/Prescription/Submissions/SubjectiveSubmissions";

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

describe("SubjectiveSubmissions Component", () => {
  const setFormData = jest.fn();
  // --- Section 1: Empty States ---

  it("renders 'No submissions yet' when subjective list is empty", () => {
    const mockData = { subjective: [] };
    render(<SubjectiveSubmissions formData={mockData as any} setFormData={setFormData as any} />);

    expect(
      screen.getByText("Previous subjective submissions")
    ).toBeInTheDocument();
    expect(screen.getByText("No submissions yet.")).toBeInTheDocument();
  });

  it("renders 'No submissions yet' when subjective property is undefined", () => {
    // formData.subjective is undefined
    const mockData = {};
    render(<SubjectiveSubmissions formData={mockData as any} setFormData={setFormData as any} />);

    expect(screen.getByText("No submissions yet.")).toBeInTheDocument();
  });

  // --- Section 2: Populated Data (Happy Path) ---

  it("renders a list of submissions correctly", () => {
    const mockData = {
      subjective: [
        {
          _id: "sub-1",
          answers: {
            Complaint: "Coughing",
            Duration: "2 days",
          },
          submittedAt: new Date(),
        },
      ],
    };

    render(<SubjectiveSubmissions formData={mockData as any} setFormData={setFormData as any} />);

    // Check Question Labels
    expect(screen.getByText("Complaint")).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();

    // Check Answers
    expect(screen.getByText("Coughing")).toBeInTheDocument();
    expect(screen.getByText("2 days")).toBeInTheDocument();
  });

  // --- Section 3: Logic & Filtering (toStringPairs) ---

  it("filters out non-string values from display", () => {
    const mockData = {
      subjective: [
        {
          _id: "sub-mixed",
          answers: {
            "Valid Symptom": "Sneezing",
            "Severity Score": 5, // Should be filtered out
            "Has Fever": true, // Should be filtered out
          },
        },
      ],
    };

    render(<SubjectiveSubmissions formData={mockData as any} setFormData={setFormData as any} />);

    // Should be visible
    expect(screen.getByText("Valid Symptom")).toBeInTheDocument();
    expect(screen.getByText("Sneezing")).toBeInTheDocument();

    // Should NOT be visible (filtered by toStringPairs)
    expect(screen.queryByText("Severity Score")).not.toBeInTheDocument();
    expect(screen.queryByText("5")).not.toBeInTheDocument();
  });

  it("does not render a submission card if it contains no valid string pairs", () => {
    const mockData = {
      subjective: [
        {
          _id: "sub-empty-pairs",
          answers: {
            "Pain Level": 10,
          },
        },
      ],
    };

    render(<SubjectiveSubmissions formData={mockData as any} setFormData={setFormData as any} />);

    // The component maps the submission but returns null because pairs.length === 0.
    const accordion = screen.getByTestId("accordion");

    // We expect the title
    expect(accordion).toHaveTextContent("Previous subjective submissions");

    // We expect NO "Pain Level" text
    expect(screen.queryByText("Pain Level")).not.toBeInTheDocument();
  });

  // --- Section 4: Edge Cases (Null/Undefined Answers) ---

  it("handles null or undefined answers object gracefully", () => {
    const mockData = {
      subjective: [
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

    render(<SubjectiveSubmissions formData={mockData as any} setFormData={setFormData as any} />);

    // Effectively rendering an empty list inside the accordion.
    expect(screen.getByTestId("accordion")).toBeInTheDocument();
    // Verify no content rendered
    expect(screen.queryByText("undefined")).not.toBeInTheDocument();
  });

  it("uses submittedAt as key if _id is missing", () => {
    const date = new Date("2025-01-01");
    const mockData = {
      subjective: [
        {
          // No _id
          submittedAt: date,
          answers: { Key: "Value" },
        },
      ],
    };

    render(<SubjectiveSubmissions formData={mockData as any} setFormData={setFormData as any} />);
    expect(screen.getByText("Value")).toBeInTheDocument();
  });
});
