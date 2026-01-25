import React from "react";
import { render, screen } from "@testing-library/react";
import Page from "@/app/(routes)/(app)/book-onboarding/page";

jest.mock("@/app/pages/BookOnboarding", () => {
  return function MockProtectedBookOnboarding() {
    return (
      <div data-testid="protected-book-onboarding-mock">
        Protected Component
      </div>
    );
  };
});

describe("Book Onboarding Page", () => {
  it("renders the ProtectedBookOnboarding component correctly", () => {
    render(<Page />);

    const childComponent = screen.getByTestId("protected-book-onboarding-mock");
    expect(childComponent).toBeInTheDocument();
  });
});
