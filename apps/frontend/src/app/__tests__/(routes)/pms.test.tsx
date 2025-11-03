import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("@/app/pages/HomePage/HomePage", () => ({
  __esModule: true,
  default: () => <div data-testid="homepage-mock">HomePage Mock</div>,
}));

import Page, * as PageModule from "@/app/(routes)/pms/page";

describe("page (Home route)", () => {
  test("renders HomePage", () => {
    render(<Page />);
    expect(screen.getByTestId("homepage-mock")).toBeInTheDocument();
  });

  test("renders HomePage as the only top-level child", () => {
    const { container } = render(<Page />);
    expect(container.children.length).toBe(1);
    expect(container.firstChild).toHaveAttribute("data-testid", "homepage-mock");
  });

  test("default export is a function", () => {
    expect(typeof Page).toBe("function");
    expect(typeof PageModule.default).toBe("function");
  });
});
