import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/app/components/DataTable/AvailabilityTable", () => ({
  __esModule: true,
  default: () => <div data-testid="availability-table" />,
}));

jest.mock("next/link", () => {
  return ({ children, ...props }: any) => <a {...props}>{children}</a>;
});

import AvailabilitySummary from "@/app/components/Summary/Availability";

describe("Summary Availability widget", () => {
  test("renders filters and passes through to table", () => {
    render(<AvailabilitySummary />);

    expect(screen.getByTestId("availability-table")).toBeInTheDocument();

    const availableButton = screen.getByRole("button", { name: "Available" });
    fireEvent.click(availableButton);
    expect(availableButton).toHaveClass("active-label-availability");

    expect(screen.getByText("See all")).toHaveAttribute(
      "href",
      "/organization"
    );
  });
});
