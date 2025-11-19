import "../../../../jest.mocks/testMocks";

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import AddressStep from "@/app/components/Steps/CreateOrg/AddressStep";

describe("CreateOrg AddressStep", () => {
  const blankForm = {
    address: "",
    area: "",
    city: "",
    state: "",
    postalCode: "",
  };

  test("validates required fields before proceeding", () => {
    const nextStep = jest.fn();
    render(
      <AddressStep
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

  test("calls nextStep when form is complete", () => {
    const nextStep = jest.fn();
    render(
      <AddressStep
        nextStep={nextStep}
        prevStep={jest.fn()}
        formData={{
          address: "123 Main",
          area: "Downtown",
          city: "Berlin",
          state: "Berlin",
          postalCode: "10115",
        }}
        setFormData={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText("Next"));
    expect(nextStep).toHaveBeenCalled();
  });
});
