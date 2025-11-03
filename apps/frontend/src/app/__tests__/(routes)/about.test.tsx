import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("@/app/pages/AboutUs/AboutUs", () => ({
  __esModule: true,
  default: () => <div data-testid="aboutus-mock">AboutUs Mock</div>,
}));

import Page, * as PageModule from "@/app/(routes)/about/page";

describe("page (AboutUs route)", () => {
  test("renders AboutUs", () => {
    render(<Page />);
    expect(screen.getByTestId("aboutus-mock")).toBeInTheDocument();
  });

  test("renders AboutUs as the only top-level child", () => {
    const { container } = render(<Page />);
    expect(container.children.length).toBe(1);
    expect(container.firstChild).toHaveAttribute("data-testid", "aboutus-mock");
  });

  test("default export is a function", () => {
    expect(typeof Page).toBe("function");
    expect(typeof PageModule.default).toBe("function");
  });
});
