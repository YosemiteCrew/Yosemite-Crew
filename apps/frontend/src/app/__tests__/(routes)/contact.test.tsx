import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("@/app/pages/ContactusPage/ContactusPage", () => ({
  __esModule: true,
  default: () => <div data-testid="contactuspage-mock">ContactusPage Mock</div>,
}));

import Page, * as PageModule from "@/app/(routes)/contact/page";

describe("page (Contact Us route)", () => {
  test("renders ContactusPage", () => {
    render(<Page />);
    expect(screen.getByTestId("contactuspage-mock")).toBeInTheDocument();
  });

  test("renders ContactusPage as the only top-level child", () => {
    const { container } = render(<Page />);
    expect(container.children.length).toBe(1);
    expect(container.firstChild).toHaveAttribute(
      "data-testid",
      "contactuspage-mock"
    );
  });

  test("default export is a function", () => {
    expect(typeof Page).toBe("function");
    expect(typeof PageModule.default).toBe("function");
  });
});
