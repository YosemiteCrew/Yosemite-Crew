import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/app/components/DevRouteGuard/DevRouteGuard", () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="dev-guard">{children}</div>,
}));

jest.mock("@iconify/react", () => ({
  Icon: () => <span data-testid="icon" />,
}));

jest.mock("next/link", () => {
  const Link = ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  Link.displayName = "Link";
  return { __esModule: true, default: Link };
});

import DeveloperDocs from "@/app/pages/DeveloperDocs/DeveloperDocs";

describe("DeveloperDocs page", () => {
  test("renders docs frame with navigation links", () => {
    render(<DeveloperDocs />);

    expect(screen.getByTestId("dev-guard")).toBeInTheDocument();
    const backLink = screen.getByRole("link", { name: /Back to portal/i });
    expect(backLink).toHaveAttribute("href", "/developers/home");

    const openLink = screen.getByRole("link", { name: /Open in new tab/i });
    expect(openLink).toHaveAttribute("href", "/dev-docs/index.html");
    expect(openLink).toHaveAttribute("target", "_blank");

    const iframe = screen.getByTitle(/developer documentation/i);
    expect(iframe).toHaveAttribute("src", "/dev-docs/index.html");
  });
});
