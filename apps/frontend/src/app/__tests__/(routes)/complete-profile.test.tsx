import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("@/app/pages/CompleteProfile/CompleteProfile", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="completeprofile-mock">CompleteProfile Mock</div>
  ),
}));

import Page, * as PageModule from "@/app/(routes)/complete-profile/page";

describe("page (CompleteProfile route)", () => {
  test("renders CompleteProfile", () => {
    render(<Page />);
    expect(screen.getByTestId("completeprofile-mock")).toBeInTheDocument();
  });

  test("renders CompleteProfile as the only top-level child", () => {
    const { container } = render(<Page />);
    expect(container.children.length).toBe(1);
    expect(container.firstChild).toHaveAttribute(
      "data-testid",
      "completeprofile-mock"
    );
  });

  test("default export is a function", () => {
    expect(typeof Page).toBe("function");
    expect(typeof PageModule.default).toBe("function");
  });
});
