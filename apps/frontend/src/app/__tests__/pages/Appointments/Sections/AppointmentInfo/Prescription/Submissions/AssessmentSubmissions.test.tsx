import React from "react";
import { render, screen } from "@testing-library/react";
// Import Path: Go up 7 levels to 'src/app', then down to 'pages'
import AssessmentSubmissions from "../../../../../../../pages/Appointments/Sections/AppointmentInfo/Prescription/Submissions/AssessmentSubmissions";

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

describe("AssessmentSubmissions Component", () => {
  // --- Section 1: Empty States ---

  it("renders 'No submissions yet' when assessment list is empty", () => {
    const mockData = { assessment: [] };
    render(<AssessmentSubmissions formData={mockData as any} />);

    expect(
      screen.getByText("Previous assessment submissions")
    ).toBeInTheDocument();
    expect(screen.getByText("No submissions yet.")).toBeInTheDocument();
  });

  it("renders 'No submissions yet' when assessment property is undefined", () => {
    // formData.assessment is undefined
    const mockData = {};
    render(<AssessmentSubmissions formData={mockData as any} />);

    expect(screen.getByText("No submissions yet.")).toBeInTheDocument();
  });

  // --- Section 2: Populated Data (Happy Path) ---

  it("renders a list of submissions correctly", () => {
    const mockData = {
      assessment: [
        {
          _id: "sub-1",
          answers: {
            Diagnosis: "Flu",
            Severity: "Moderate",
          },
          submittedAt: new Date(),
        },
      ],
    };

    render(<AssessmentSubmissions formData={mockData as any} />);

    // Check Question Labels
    expect(screen.getByText("Diagnosis")).toBeInTheDocument();
    expect(screen.getByText("Severity")).toBeInTheDocument();

    // Check Answers
    expect(screen.getByText("Flu")).toBeInTheDocument();
    expect(screen.getByText("Moderate")).toBeInTheDocument();
  });

  // --- Section 3: Logic & Filtering (toStringPairs) ---

  it("filters out non-string values from display", () => {
    const mockData = {
      assessment: [
        {
          _id: "sub-mixed",
          answers: {
            "Valid String": "Show Me",
            "Number Value": 123, // Should be filtered out
            "Boolean Value": true, // Should be filtered out
          },
        },
      ],
    };

    render(<AssessmentSubmissions formData={mockData as any} />);

    // Should be visible
    expect(screen.getByText("Valid String")).toBeInTheDocument();
    expect(screen.getByText("Show Me")).toBeInTheDocument();

    // Should NOT be visible (filtered by toStringPairs)
    expect(screen.queryByText("Number Value")).not.toBeInTheDocument();
    expect(screen.queryByText("123")).not.toBeInTheDocument();
  });

  it("does not render a submission card if it contains no valid string pairs", () => {
    const mockData = {
      assessment: [
        {
          _id: "sub-empty-pairs",
          answers: {
            "Only Number": 100,
          },
        },
      ],
    };

    render(<AssessmentSubmissions formData={mockData as any} />);

    // The component maps the submission but returns null because pairs.length === 0
    // So the list container exists, but is empty of cards.
    const accordion = screen.getByTestId("accordion");

    // We expect the text "Previous assessment submissions" (Title)
    expect(accordion).toHaveTextContent("Previous assessment submissions");

    // We expect NO "Only Number" text
    expect(screen.queryByText("Only Number")).not.toBeInTheDocument();
  });

  // --- Section 4: Edge Cases (Null/Undefined Answers) ---

  it("handles null or undefined answers object gracefully", () => {
    const mockData = {
      assessment: [
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

    render(<AssessmentSubmissions formData={mockData as any} />);

    // Neither should throw errors, and neither should display content
    // Because pairs will be [], so it returns null.
    // Effectively rendering an empty list inside the accordion.
    expect(screen.getByTestId("accordion")).toBeInTheDocument();
    // Verify no cards rendered (by checking for any common card class or just text)
    expect(screen.queryByText("undefined")).not.toBeInTheDocument();
  });

  it("uses submittedAt as key if _id is missing", () => {
    const date = new Date("2025-01-01");
    const mockData = {
      assessment: [
        {
          // No _id
          submittedAt: date,
          answers: { Key: "Value" },
        },
      ],
    };

    render(<AssessmentSubmissions formData={mockData as any} />);
    expect(screen.getByText("Value")).toBeInTheDocument();
  });
});
