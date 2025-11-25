import "../../../../jest.mocks/testMocks";

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import PersonalStep from "@/app/components/Steps/TeamOnboarding/PersonalStep";

const blankForm = {
  firstName: "",
  lastName: "",
  dob: "",
  gender: "male",
  country: "",
  number: "",
  address: "",
  area: "",
  city: "",
  state: "",
  postalCode: "",
};

const validForm = {
  ...blankForm,
  firstName: "Jane",
  lastName: "Doe",
  dob: "1990-01-01",
  country: "Germany",
  number: "123456789",
  address: "Street 123",
  area: "Downtown",
  city: "Berlin",
  state: "Berlin",
  postalCode: "10115",
};

describe("TeamOnboarding PersonalStep", () => {
  test("blocks progression when required fields missing", () => {
    const nextStep = jest.fn();
    render(
      <PersonalStep
        nextStep={nextStep}
        formData={blankForm}
        setFormData={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText("Next"));
    expect(nextStep).not.toHaveBeenCalled();
    expect(screen.getAllByText(/is required/).length).toBeGreaterThan(0);
  });

  test("calls nextStep when form passes validation", () => {
    const nextStep = jest.fn();
    render(
      <PersonalStep
        nextStep={nextStep}
        formData={validForm}
        setFormData={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText("Next"));
    expect(nextStep).toHaveBeenCalled();
  });
});
