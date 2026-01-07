import React from "react";
import { render, screen } from "@testing-library/react";
// Import Path: Go up 7 levels to 'src/app', then down to 'pages'
import PlanSubmissions from "../../../../../../../pages/Appointments/Sections/AppointmentInfo/Prescription/Submissions/PlanSubmissions";

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

describe("PlanSubmissions Component", () => {
  // --- Section 1: Empty States ---

  it("renders 'No submissions yet' when plan list is empty", () => {
    const mockData = { plan: [] };
    render(<PlanSubmissions formData={mockData as any} />);

    expect(screen.getByText("Previous plan submissions")).toBeInTheDocument();
    expect(screen.getByText("No submissions yet.")).toBeInTheDocument();
  });

  it("renders 'No submissions yet' when plan property is undefined", () => {
    // formData.plan is undefined
    const mockData = {};
    render(<PlanSubmissions formData={mockData as any} />);

    expect(screen.getByText("No submissions yet.")).toBeInTheDocument();
  });

  // --- Section 2: Populated Data (Happy Path) ---

  it("renders a list of submissions correctly", () => {
    const mockData = {
      plan: [
        {
          _id: "sub-1",
          answers: {
            Procedure: "Surgery",
            Date: "Next Tuesday",
          },
          submittedAt: new Date(),
        },
      ],
    };

    render(<PlanSubmissions formData={mockData as any} />);

    // Check Question Labels
    expect(screen.getByText("Procedure")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();

    // Check Answers
    expect(screen.getByText("Surgery")).toBeInTheDocument();
    expect(screen.getByText("Next Tuesday")).toBeInTheDocument();
  });

  // --- Section 3: Logic & Filtering (toStringPairs) ---

  it("filters out non-string values from display", () => {
    const mockData = {
      plan: [
        {
          _id: "sub-mixed",
          answers: {
            "Valid Plan": "Rest",
            "Duration Days": 7, // Should be filtered out
            "Is Urgent": true, // Should be filtered out
          },
        },
      ],
    };

    render(<PlanSubmissions formData={mockData as any} />);

    // Should be visible
    expect(screen.getByText("Valid Plan")).toBeInTheDocument();
    expect(screen.getByText("Rest")).toBeInTheDocument();

    // Should NOT be visible (filtered by toStringPairs)
    expect(screen.queryByText("Duration Days")).not.toBeInTheDocument();
    expect(screen.queryByText("7")).not.toBeInTheDocument();
  });

  it("does not render a submission card if it contains no valid string pairs", () => {
    const mockData = {
      plan: [
        {
          _id: "sub-empty-pairs",
          answers: {
            "Cost Estimate": 500,
          },
        },
      ],
    };

    render(<PlanSubmissions formData={mockData as any} />);

    // The component maps the submission but returns null because pairs.length === 0.
    const accordion = screen.getByTestId("accordion");

    // We expect the title
    expect(accordion).toHaveTextContent("Previous plan submissions");

    // We expect NO "Cost Estimate" text
    expect(screen.queryByText("Cost Estimate")).not.toBeInTheDocument();
  });

  // --- Section 4: Edge Cases (Null/Undefined Answers) ---

  it("handles null or undefined answers object gracefully", () => {
    const mockData = {
      plan: [
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

    render(<PlanSubmissions formData={mockData as any} />);

    // Effectively rendering an empty list inside the accordion.
    expect(screen.getByTestId("accordion")).toBeInTheDocument();
    // Verify no content rendered
    expect(screen.queryByText("undefined")).not.toBeInTheDocument();
  });

  it("uses submittedAt as key if _id is missing", () => {
    const date = new Date("2025-01-01");
    const mockData = {
      plan: [
        {
          // No _id
          submittedAt: date,
          answers: { Key: "Value" },
        },
      ],
    };

    render(<PlanSubmissions formData={mockData as any} />);
    expect(screen.getByText("Value")).toBeInTheDocument();
  });
});
