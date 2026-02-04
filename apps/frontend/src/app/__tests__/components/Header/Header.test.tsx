import React from "react";
import { render, screen } from "@testing-library/react";

const mockUsePathname = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

jest.mock("@/app/ui/layout/Header/GuestHeader/GuestHeader", () => () => (
  <div data-testid="guest-header" />
));
jest.mock("@/app/ui/layout/Header/UserHeader/UserHeader", () => () => (
  <div data-testid="user-header" />
));

import Header from "@/app/ui/layout/Header/Header";

describe("Header", () => {
  test("renders GuestHeader on public routes", () => {
    mockUsePathname.mockReturnValue("/pricing");
    render(<Header />);

    expect(screen.getByTestId("guest-header")).toBeInTheDocument();
    expect(screen.queryByTestId("user-header")).not.toBeInTheDocument();
  });
});
