import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/app/pages/PricingPage/PricingPage", () => ({
  NeedHealp: () => <div data-testid="need-help" />,
}));

import TermsAndConditions from "@/app/pages/TermsAndConditions/TermsAndConditions";

describe("TermsAndConditions page", () => {
  test("renders headline content and support section", () => {
    render(<TermsAndConditions />);

    expect(
      screen.getByRole("heading", {
        name: /Yosemite Crew License and Subscription Terms/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getAllByRole("heading", { name: /1\. DEFINITIONS/i })[0]
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Admin Account/i)[0]).toBeInTheDocument();
    expect(screen.getByTestId("need-help")).toBeInTheDocument();
  });
});
