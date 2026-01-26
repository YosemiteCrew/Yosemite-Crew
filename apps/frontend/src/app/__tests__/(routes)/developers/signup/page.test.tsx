import React from "react";
import { render, screen } from "@testing-library/react";
import Page from "@/app/(routes)/(public)/developers/signup/page";
import SignUp from "@/app/pages/SignUp/SignUp";

jest.mock("@/app/pages/SignUp/SignUp", () => {
  return jest.fn(() => <div data-testid="mock-signup">SignUp Component</div>);
});

describe("Developer SignUp Page", () => {
  beforeEach(() => {
    (SignUp as jest.Mock).mockClear();
  });

  it("renders the SignUp component with the correct developer configuration props", () => {
    render(<Page />);

    expect(screen.getByTestId("mock-signup")).toBeInTheDocument();
  });
});
