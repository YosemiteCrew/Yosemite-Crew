import React from "react";
import { render, screen } from "@testing-library/react";
import Page from "@/app/(routes)/forms/page";

jest.mock("@/app/pages/Forms", () => {
  return function MockProtectedForms() {
    return <div data-testid="protected-forms-mock">Forms Page Content</div>;
  };
});

describe("Forms Page", () => {
  it("renders the ProtectedForms component correctly", () => {
    render(<Page />);

    const childComponent = screen.getByTestId("protected-forms-mock");
    expect(childComponent).toBeInTheDocument();
  });
});
