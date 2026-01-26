import React from "react";
import { render, screen } from "@testing-library/react";
import Page from "@/app/(routes)/(public)/developers/signin/page";
import SignIn from "@/app/pages/SignIn/SignIn";

jest.mock("@/app/pages/SignIn/SignIn", () => {
  return jest.fn(() => <div data-testid="mock-signin">SignIn Component</div>);
});

describe("Developer SignIn Page", () => {
  beforeEach(() => {
    (SignIn as jest.Mock).mockClear();
  });

  it("renders the SignIn component with the correct developer configuration props", () => {
    render(<Page />);

    expect(screen.getByTestId("mock-signin")).toBeInTheDocument();
  });
});
