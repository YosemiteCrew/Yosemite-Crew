import React from "react";
import { render, screen } from "@testing-library/react";

const mockUsePathname = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

jest.mock("@/app/components/Header/GuestHeader/GuestHeader", () => () => (
  <div data-testid="guest-header" />
));
jest.mock("@/app/components/Header/UserHeader/UserHeader", () => () => (
  <div data-testid="user-header" />
));

import Header from "@/app/components/Header/Header";

describe("Header", () => {
  test("renders GuestHeader on public routes", () => {
    mockUsePathname.mockReturnValue("/pricing");
    render(<Header />);

    expect(screen.getByTestId("guest-header")).toBeInTheDocument();
    expect(screen.queryByTestId("user-header")).not.toBeInTheDocument();
  });
});
