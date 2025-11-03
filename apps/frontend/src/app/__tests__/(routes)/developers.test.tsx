import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("@/app/pages/DeveloperLanding/DeveloperLanding", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="developerlanding-mock">DeveloperLanding Mock</div>
  ),
}));

import Page, * as PageModule from "@/app/(routes)/developers/page";

describe("page (DeveloperLanding route)", () => {
  test("renders DeveloperLanding", () => {
    render(<Page />);
    expect(screen.getByTestId("developerlanding-mock")).toBeInTheDocument();
  });

  test("renders DeveloperLanding as the only top-level child", () => {
    const { container } = render(<Page />);
    expect(container.children.length).toBe(1);
    expect(container.firstChild).toHaveAttribute(
      "data-testid",
      "developerlanding-mock"
    );
  });

  test("default export is a function", () => {
    expect(typeof Page).toBe("function");
    expect(typeof PageModule.default).toBe("function");
  });
});
