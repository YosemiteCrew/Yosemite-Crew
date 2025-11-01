import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("@/app/pages/PricingPage/PricingPage", () => ({
  __esModule: true,
  default: () => <div data-testid="pricingpage-mock">PricingPage Mock</div>,
}));

import Page, * as PageModule from "@/app/(routes)/pricing/page";

describe("page (Pricing route)", () => {
  test("renders PricingPage", () => {
    render(<Page />);
    expect(screen.getByTestId("pricingpage-mock")).toBeInTheDocument();
  });

  test("renders PricingPage as the only top-level child", () => {
    const { container } = render(<Page />);
    expect(container.children.length).toBe(1);
    expect(container.firstChild).toHaveAttribute(
      "data-testid",
      "pricingpage-mock"
    );
  });

  test("default export is a function", () => {
    expect(typeof Page).toBe("function");
    expect(typeof PageModule.default).toBe("function");
  });
});
