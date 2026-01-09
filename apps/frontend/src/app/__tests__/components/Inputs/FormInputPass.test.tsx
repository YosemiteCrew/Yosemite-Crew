import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("next/image", () => {
  return ({ alt = "", ...props }: any) => <img alt={alt} {...props} />;
});

jest.mock("react-bootstrap", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

import FormInputPass from "@/app/components/Inputs/FormInputPass/FormInputPass";

describe("FormInputPass", () => {
  test("renders password field with label", () => {
    render(
      <FormInputPass
        intype="password"
        inname="password"
        inlabel="Password"
        value="secret"
        onChange={jest.fn()}
      />
    );

    const input = screen.getByLabelText<HTMLInputElement>("Password");
    expect(input).toBeInTheDocument();
    expect(input.type).toBe("password");
  });

  test("toggle button switches between password and text", () => {
    render(
      <FormInputPass
        intype="password"
        inname="password"
        inlabel="Password"
        value="secret"
        onChange={jest.fn()}
      />
    );
  });

  test("displays error text", () => {
    render(
      <FormInputPass
        intype="password"
        inname="password"
        inlabel="Password"
        value=""
        onChange={jest.fn()}
        error="Required"
      />
    );

    expect(screen.getByText("Required")).toBeInTheDocument();
  });
});
