import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("@/app/pages/TermsAndConditions/TermsAndConditions", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="termsandconditions-mock">TermsAndConditions Mock</div>
  ),
}));

jest.mock("@/app/components/Footer/Footer", () => ({
  __esModule: true,
  default: () => <footer data-testid="footer-mock">Footer Mock</footer>,
}));

import Page, * as PageModule from "@/app/(routes)/terms-and-conditions/page";

describe("page (Terms and Conditions route)", () => {
  test("renders TermsAndConditions and Footer", () => {
    render(<Page />);
    expect(screen.getByTestId("termsandconditions-mock")).toBeInTheDocument();
    expect(screen.getByTestId("footer-mock")).toBeInTheDocument();
  });

  test("renders both components in correct order", () => {
    const { container } = render(<Page />);
    const [terms, footer] = container.children[0].children;
    expect(terms).toHaveAttribute("data-testid", "termsandconditions-mock");
    expect(footer).toHaveAttribute("data-testid", "footer-mock");
  });

  test("default export is a function", () => {
    expect(typeof Page).toBe("function");
    expect(typeof PageModule.default).toBe("function");
  });
});
