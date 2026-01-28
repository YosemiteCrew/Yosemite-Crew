import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import SoapSubmissions from "@/app/pages/Appointments/Sections/AppointmentInfo/Prescription/Submissions/SoapSubmissions";

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid="accordion">
      <div>{title}</div>
      <div>{children}</div>
    </div>
  ),
}));

const cases = [
  { key: "assessment", title: "Previous assessment submissions" },
  { key: "objective", title: "Previous objective submissions" },
  { key: "subjective", title: "Previous subjective submissions" },
  { key: "discharge", title: "Previous discharge submissions" },
  { key: "plan", title: "Previous plan submissions" },
] as const;

describe.each(cases)("SoapSubmissions (%s)", ({ key, title }) => {
  const setFormData = jest.fn();

  it("renders empty state", () => {
    render(
      <SoapSubmissions
        formData={{ [key]: [] } as any}
        setFormData={setFormData as any}
        formDataKey={key}
        title={title}
      />,
    );

    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText("No submissions yet.")).toBeInTheDocument();
  });

  it("renders submission answers", () => {
    render(
      <SoapSubmissions
        formData={{
          [key]: [
            {
              _id: "sub-1",
              answers: { Diagnosis: "Allergy" },
            },
          ],
        } as any}
        setFormData={setFormData as any}
        formDataKey={key}
        title={title}
      />,
    );

    expect(screen.getByText("Diagnosis")).toBeInTheDocument();
    expect(screen.getByText("Allergy")).toBeInTheDocument();
  });
});
