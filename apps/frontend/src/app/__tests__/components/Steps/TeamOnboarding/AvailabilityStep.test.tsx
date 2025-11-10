import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text }: any) => <a href="/dashboard">{text}</a>,
  Secondary: ({ text, onClick }: any) => (
    <button onClick={(e: any) => onClick?.(e)}>{text}</button>
  ),
}));

jest.mock("@/app/components/Availability/Availability", () => ({
  __esModule: true,
  default: () => <div data-testid="availability-component" />,
}));

import AvailabilityStep from "@/app/components/Steps/TeamOnboarding/AvailabilityStep";

describe("TeamOnboarding AvailabilityStep", () => {
  test("renders availability component and handles back action", () => {
    const prevStep = jest.fn();
    render(<AvailabilityStep prevStep={prevStep} />);

    expect(screen.getByTestId("availability-component")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Back"));
    expect(prevStep).toHaveBeenCalled();

    expect(screen.getByText("Next")).toHaveAttribute("href", "/dashboard");
  });
});
