import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("@/app/pages/PrivacyPolicy/PrivacyPolicy", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="privacypolicy-mock">PrivacyPolicy Mock</div>
  ),
}));

import Page, * as PageModule from "@/app/(routes)/privacy-policy/page";

describe("page (Privacy Policy route)", () => {
  test("renders PrivacyPolicy", () => {
    render(<Page />);
    expect(screen.getByTestId("privacypolicy-mock")).toBeInTheDocument();
  });

  test("renders PrivacyPolicy as the only top-level child", () => {
    const { container } = render(<Page />);
    expect(container.children.length).toBe(1);
    expect(container.firstChild).toHaveAttribute(
      "data-testid",
      "privacypolicy-mock"
    );
  });

  test("default export is a function", () => {
    expect(typeof Page).toBe("function");
    expect(typeof PageModule.default).toBe("function");
  });
});
