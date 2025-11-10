import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("next/image", () => {
  return ({ alt = "", ...props }: any) => <img alt={alt} {...props} />;
});

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, href }: any) => (
    <a data-testid="book-call" href={href}>
      {text}
    </a>
  ),
}));

import DashboardProfile from "@/app/components/DashboardProfile/DashboardProfile";

describe("DashboardProfile", () => {
  test("renders welcome copy and CTA", () => {
    render(<DashboardProfile />);

    expect(screen.getByText("Welcome")).toBeInTheDocument();
    expect(screen.getByText("Sky Blue")).toBeInTheDocument();
    expect(screen.getByTestId("book-call")).toHaveAttribute(
      "href",
      "/book-demo"
    );
  });
});
