import React from "react";
import { render, screen } from "@testing-library/react";
import Page from "@/app/(routes)/finance/page";

jest.mock("@/app/pages/Finance", () => {
  return function MockProtectedFinance() {
    return <div data-testid="protected-finance-mock">Finance Dashboard</div>;
  };
});

describe("Finance Page", () => {
  it("renders the ProtectedFinance component correctly", () => {
    render(<Page />);

    const childComponent = screen.getByTestId("protected-finance-mock");
    expect(childComponent).toBeInTheDocument();
  });
});
