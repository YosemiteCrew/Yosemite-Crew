import "../../../../test-helpers/testMocks";

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/app/components/Inputs/FileInput/FileInput", () => ({
  __esModule: true,
  default: () => <div data-testid="file-input" />,
}));

import ProfessionalStep from "@/app/components/Steps/TeamOnboarding/ProfessionalStep";

const blankForm = {
  linkedin: "",
  licenseNumber: "",
  yearsExperience: "",
  specialisation: "",
  qualification: "",
  biography: "",
  uploadCV: "",
};

describe("TeamOnboarding ProfessionalStep", () => {
  test("validates required professional fields", () => {
    const nextStep = jest.fn();
    render(
      <ProfessionalStep
        nextStep={nextStep}
        prevStep={jest.fn()}
        formData={blankForm}
        setFormData={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText("Next"));
    expect(nextStep).not.toHaveBeenCalled();
    expect(screen.getAllByText(/is required/).length).toBeGreaterThan(0);
  });

  test("calls nextStep when required fields are present", () => {
    const nextStep = jest.fn();
    render(
      <ProfessionalStep
        nextStep={nextStep}
        prevStep={jest.fn()}
        formData={{
          ...blankForm,
          yearsExperience: "5",
          specialisation: "Dentistry",
          qualification: "DVM",
        }}
        setFormData={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText("Next"));
    expect(nextStep).toHaveBeenCalled();
  });
});
