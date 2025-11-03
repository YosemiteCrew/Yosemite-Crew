import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("@/app/pages/Organizations/Organizations", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="protectedorganizations-mock">
      ProtectedOrganizations Mock
    </div>
  ),
}));

import Page, * as PageModule from "@/app/(routes)/organizations/page";

describe("page (Organizations route)", () => {
  test("renders ProtectedOrganizations", () => {
    render(<Page />);
    expect(
      screen.getByTestId("protectedorganizations-mock")
    ).toBeInTheDocument();
  });

  test("renders ProtectedOrganizations as the only top-level child", () => {
    const { container } = render(<Page />);
    expect(container.children.length).toBe(1);
    expect(container.firstChild).toHaveAttribute(
      "data-testid",
      "protectedorganizations-mock"
    );
  });

  test("default export is a function", () => {
    expect(typeof Page).toBe("function");
    expect(typeof PageModule.default).toBe("function");
  });
});
