import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("@/app/pages/PetOwner/PetOwner", () => ({
  __esModule: true,
  default: () => <div data-testid="petowner-mock">PetOwner Mock</div>,
}));

import Page, * as PageModule from "@/app/(routes)/application/page";

describe("page (Applications route)", () => {
  test("renders PetOwner", () => {
    render(<Page />);
    expect(screen.getByTestId("petowner-mock")).toBeInTheDocument();
  });

  test("renders PetOwner as the only top-level child", () => {
    const { container } = render(<Page />);
    expect(container.children.length).toBe(1);
    expect(container.firstChild).toHaveAttribute(
      "data-testid",
      "petowner-mock"
    );
  });

  test("default export is a function", () => {
    expect(typeof Page).toBe("function");
    expect(typeof PageModule.default).toBe("function");
  });
});
