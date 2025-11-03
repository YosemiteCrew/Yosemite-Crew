import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("@/app/pages/AdminDashboardEmpty/AdminDashboardEmpty", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="admindashboardempty-mock">AdminDashboardEmpty Mock</div>
  ),
}));

import Page, * as PageModule from "@/app/(routes)/empty-dashboard/page";

describe("page (AdminDashboardEmpty route)", () => {
  test("renders AdminDashboardEmpty", () => {
    render(<Page />);
    expect(screen.getByTestId("admindashboardempty-mock")).toBeInTheDocument();
  });

  test("renders AdminDashboardEmpty as the only top-level child", () => {
    const { container } = render(<Page />);
    expect(container.children.length).toBe(1);
    expect(container.firstChild).toHaveAttribute(
      "data-testid",
      "admindashboardempty-mock"
    );
  });

  test("default export is a function", () => {
    expect(typeof Page).toBe("function");
    expect(typeof PageModule.default).toBe("function");
  });
});
