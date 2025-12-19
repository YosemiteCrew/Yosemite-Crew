import React from "react";
import { render, screen } from "@testing-library/react";
// Import Path: Go up 7 levels to 'src/app', then down to 'pages'
import ObjectiveSubmissions from "../../../../../../../pages/Appointments/Sections/AppointmentInfo/Prescription/Submissions/ObjectiveSubmissions";

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

describe("ObjectiveSubmissions Component", () => {
  // --- Section 1: Empty States ---

  it("renders 'No submissions yet' when objective list is empty", () => {
    const mockData = { objective: [] };
    render(<ObjectiveSubmissions formData={mockData as any} />);

    expect(
      screen.getByText("Previous objective submissions")
    ).toBeInTheDocument();
    expect(screen.getByText("No submissions yet.")).toBeInTheDocument();
  });

  it("renders 'No submissions yet' when objective property is undefined", () => {
    // formData.objective is undefined
    const mockData = {};
    render(<ObjectiveSubmissions formData={mockData as any} />);

    expect(screen.getByText("No submissions yet.")).toBeInTheDocument();
  });

  // --- Section 2: Populated Data (Happy Path) ---

  it("renders a list of submissions correctly", () => {
    const mockData = {
      objective: [
        {
          _id: "sub-1",
          answers: {
            "Heart Rate": "120 bpm",
            Weight: "15 kg",
          },
          submittedAt: new Date(),
        },
      ],
    };

    render(<ObjectiveSubmissions formData={mockData as any} />);

    // Check Question Labels
    expect(screen.getByText("Heart Rate")).toBeInTheDocument();
    expect(screen.getByText("Weight")).toBeInTheDocument();

    // Check Answers
    expect(screen.getByText("120 bpm")).toBeInTheDocument();
    expect(screen.getByText("15 kg")).toBeInTheDocument();
  });

  // --- Section 3: Logic & Filtering (toStringPairs) ---

  it("filters out non-string values from display", () => {
    const mockData = {
      objective: [
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

    render(<ObjectiveSubmissions formData={mockData as any} />);

    // Should be visible
    expect(screen.getByText("Valid String")).toBeInTheDocument();
    expect(screen.getByText("Show Me")).toBeInTheDocument();

    // Should NOT be visible (filtered by toStringPairs)
    expect(screen.queryByText("Number Value")).not.toBeInTheDocument();
    expect(screen.queryByText("123")).not.toBeInTheDocument();
  });

  it("does not render a submission card if it contains no valid string pairs", () => {
    const mockData = {
      objective: [
        {
          _id: "sub-empty-pairs",
          answers: {
            "Only Number": 100,
          },
        },
      ],
    };

    render(<ObjectiveSubmissions formData={mockData as any} />);

    // The component maps the submission but returns null because pairs.length === 0.
    const accordion = screen.getByTestId("accordion");

    // We expect the title
    expect(accordion).toHaveTextContent("Previous objective submissions");

    // We expect NO "Only Number" text
    expect(screen.queryByText("Only Number")).not.toBeInTheDocument();
  });

  // --- Section 4: Edge Cases (Null/Undefined Answers) ---

  it("handles null or undefined answers object gracefully", () => {
    const mockData = {
      objective: [
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

    render(<ObjectiveSubmissions formData={mockData as any} />);

    // Effectively rendering an empty list inside the accordion.
    expect(screen.getByTestId("accordion")).toBeInTheDocument();
    // Verify no content rendered
    expect(screen.queryByText("undefined")).not.toBeInTheDocument();
  });

  it("uses submittedAt as key if _id is missing", () => {
    const date = new Date("2025-01-01");
    const mockData = {
      objective: [
        {
          // No _id
          submittedAt: date,
          answers: { Key: "Value" },
        },
      ],
    };

    render(<ObjectiveSubmissions formData={mockData as any} />);
    expect(screen.getByText("Value")).toBeInTheDocument();
  });
});
