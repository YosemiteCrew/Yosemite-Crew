import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("@/app/pages/BusinessDashboard/BusinessDashboard", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="businessdashboard-mock">BusinessDashboard Mock</div>
  ),
}));

import Page, * as PageModule from "@/app/(routes)/business-dashboard/page";

describe("page (BusinessDashboard route)", () => {
  test("renders BusinessDashboard", () => {
    render(<Page />);
    expect(screen.getByTestId("businessdashboard-mock")).toBeInTheDocument();
  });

  test("renders BusinessDashboard as the only top-level child", () => {
    const { container } = render(<Page />);
    expect(container.children.length).toBe(1);
    expect(container.firstChild).toHaveAttribute(
      "data-testid",
      "businessdashboard-mock"
    );
  });

  test("default export is a function", () => {
    expect(typeof Page).toBe("function");
    expect(typeof PageModule.default).toBe("function");
  });
});
