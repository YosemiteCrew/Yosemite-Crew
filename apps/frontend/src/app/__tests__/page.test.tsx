import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("@/app/pages/LandingPage/LandingPage", () => ({
  __esModule: true,
  default: () => <div data-testid="landingpage-mock">LandingPage Mock</div>,
}));

import Home, * as HomeModule from "@/app/page";

describe("Home page (root route)", () => {
  test("renders LandingPage", () => {
    render(<Home />);
    expect(screen.getByTestId("landingpage-mock")).toBeInTheDocument();
  });

  test("renders LandingPage as the only top-level child", () => {
    const { container } = render(<Home />);
    expect(container.children.length).toBe(1);
    expect(container.firstChild).toHaveAttribute(
      "data-testid",
      "landingpage-mock"
    );
  });

  test("default export is a function", () => {
    expect(typeof Home).toBe("function");
    expect(typeof HomeModule.default).toBe("function");
  });
});
