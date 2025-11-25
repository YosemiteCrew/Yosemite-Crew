import "../../../../jest.mocks/testMocks";

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import OrgStep from "@/app/components/Steps/CreateOrg/OrgStep";

describe("CreateOrg OrgStep", () => {
  const baseForm = {
    name: "",
    country: "",
    number: "",
    taxId: "",
    duns: "",
    website: "",
    healthCertficate: "",
    animalWelfareCompliance: "",
    fireCompliance: "",
  };

  test("shows validation errors when required fields missing", () => {
    const nextStep = jest.fn();
    render(
      <OrgStep
        nextStep={nextStep}
        formData={baseForm}
        setFormData={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText("Next"));
    expect(nextStep).not.toHaveBeenCalled();
    expect(screen.getAllByText(/is required/).length).toBeGreaterThan(0);
  });

  test("progresses to next step with complete form", () => {
    const nextStep = jest.fn();
    render(
      <OrgStep
        nextStep={nextStep}
        formData={{
          ...baseForm,
          name: "Clinic",
          country: "Germany",
          number: "123456789",
          taxId: "DE123",
        }}
        setFormData={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText("Next"));
    expect(nextStep).toHaveBeenCalled();
  });
});
