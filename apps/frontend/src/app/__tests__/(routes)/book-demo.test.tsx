import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("@/app/pages/BookDemo/BookDemo", () => ({
  __esModule: true,
  default: () => <div data-testid="bookdemo-mock">BookDemo Mock</div>,
}));

import Page, * as PageModule from "@/app/(routes)/book-demo/page";

describe("page (BookDemo route)", () => {
  test("renders BookDemo", () => {
    render(<Page />);
    expect(screen.getByTestId("bookdemo-mock")).toBeInTheDocument();
  });

  test("renders BookDemo as the only top-level child", () => {
    const { container } = render(<Page />);
    expect(container.children.length).toBe(1);
    expect(container.firstChild).toHaveAttribute(
      "data-testid",
      "bookdemo-mock"
    );
  });

  test("default export is a function", () => {
    expect(typeof Page).toBe("function");
    expect(typeof PageModule.default).toBe("function");
  });
});
