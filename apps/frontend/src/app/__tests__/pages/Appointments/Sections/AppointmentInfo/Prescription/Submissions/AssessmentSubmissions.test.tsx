import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AssessmentSubmissions from "@/app/pages/Appointments/Sections/AppointmentInfo/Prescription/Submissions/AssessmentSubmissions";

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid="accordion">
      <div>{title}</div>
      <div>{children}</div>
    </div>
  ),
}));

describe("AssessmentSubmissions", () => {
  const setFormData = jest.fn();
  it("renders empty state", () => {
    render(
      <AssessmentSubmissions
        formData={{ assessment: [] } as any}
        setFormData={setFormData as any}
      />,
    );

    expect(
      screen.getByText("Previous assessment submissions")
    ).toBeInTheDocument();
    expect(screen.getByText("No submissions yet.")).toBeInTheDocument();
  });

  it("renders submission answers", () => {
    render(
      <AssessmentSubmissions
        formData={{
          assessment: [
            {
              _id: "sub-1",
              answers: { Diagnosis: "Allergy" },
            },
          ],
        } as any}
        setFormData={setFormData as any}
      />
    );

    expect(screen.getByText("Diagnosis")).toBeInTheDocument();
    expect(screen.getByText("Allergy")).toBeInTheDocument();
  });
});
