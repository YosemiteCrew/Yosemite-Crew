import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockUsePathname = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

const mockCheckSession = jest.fn();
jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: () => ({
    checkSession: mockCheckSession,
  }),
}));

jest.mock("@/app/components/Header/Header", () => () => (
  <div data-testid="header" />
));
jest.mock("@/app/components/Cookies/Cookies", () => () => (
  <div data-testid="cookies" />
));
jest.mock("@/app/components/Github/Github", () => () => (
  <div data-testid="github" />
));
jest.mock("@/app/components/Sidebar/Sidebar", () => () => (
  <div data-testid="sidebar" />
));

import SessionInitializer from "@/app/components/SessionInitializer";

describe("SessionInitializer", () => {
  beforeEach(() => {
    mockCheckSession.mockClear();
  });

  test("renders public layout for public routes", () => {
    mockUsePathname.mockReturnValue("/about");

    const { container } = render(
      <SessionInitializer>
        <p>Public content</p>
      </SessionInitializer>
    );

    expect(mockCheckSession).toHaveBeenCalled();
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByTestId("cookies")).toBeInTheDocument();
    expect(screen.getByTestId("github")).toBeInTheDocument();
    expect(container.querySelector(".bodywrapper")).toHaveTextContent(
      "Public content"
    );
    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
  });

  test("renders sidebar layout for protected routes", () => {
    mockUsePathname.mockReturnValue("/dashboard");

    const { container } = render(
      <SessionInitializer>
        <p>Private content</p>
      </SessionInitializer>
    );

    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(container.querySelector(".sidebarbodywrapper")).toHaveTextContent(
      "Private content"
    );
  });
});
