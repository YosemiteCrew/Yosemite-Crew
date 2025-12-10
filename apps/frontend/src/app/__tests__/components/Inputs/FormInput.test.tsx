import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import FormInput from "@/app/components/Inputs/FormInput/FormInput";

describe("FormInput", () => {
  test("renders label and value", () => {
    render(
      <FormInput
        intype="text"
        inname="firstName"
        inlabel="First name"
        value="Jane"
        onChange={jest.fn()}
      />
    );

    const input = screen.getByLabelText("First name");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("name", "firstName");
  });

  test("shows validation error helper text", () => {
    render(
      <FormInput
        intype="text"
        inname="postal"
        inlabel="Postal code"
        value=""
        onChange={jest.fn()}
        error="Postal code is required"
      />
    );

    expect(screen.getByText("Postal code is required")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Postal code" })).toHaveClass(
      "is-invalid"
    );
  });
});
