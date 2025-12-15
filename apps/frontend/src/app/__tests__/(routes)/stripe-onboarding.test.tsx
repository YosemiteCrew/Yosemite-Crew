import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("@/app/pages/StripeOnboarding", () => ({
  __esModule: true,
  default: () => <div data-testid="route-stripe-onboarding" />,
}));

import StripeOnboardingRoute from "@/app/(routes)/stripe-onboarding/page";

describe("stripe onboarding route", () => {
  it("renders StripeOnboarding wrapper", () => {
    render(<StripeOnboardingRoute />);
    expect(screen.getByTestId("route-stripe-onboarding")).toBeInTheDocument();
  });
});
