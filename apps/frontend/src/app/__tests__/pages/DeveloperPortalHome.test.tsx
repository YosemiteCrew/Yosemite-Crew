import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const useAuthStoreMock = jest.fn();

jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: () => useAuthStoreMock(),
}));

jest.mock("@/app/components/Buttons", () => ({
  __esModule: true,
  Primary: ({ text, href }: any) => (
    <a href={href} data-testid={`primary-${text}`}>
      {text}
    </a>
  ),
  Secondary: ({ text, href }: any) => (
    <a href={href} data-testid={`secondary-${text}`}>
      {text}
    </a>
  ),
}));

jest.mock("@/app/components/DevRouteGuard/DevRouteGuard", () => ({
  __esModule: true,
  default: ({ children }: any) => (
    <div data-testid="dev-guard">{children}</div>
  ),
}));

import DeveloperPortalHome from "@/app/pages/DeveloperPortalHome/DeveloperPortalHome";

const createSession = (payload: any) => ({
  getIdToken: () => ({
    decodePayload: () => payload,
  }),
});

describe("DeveloperPortalHome page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders developer home content when authenticated", () => {
    useAuthStoreMock.mockReturnValue({
      session: createSession({
        given_name: "Ada",
        family_name: "Lovelace",
      }),
    });

    render(<DeveloperPortalHome />);

    expect(screen.getByTestId("dev-guard")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Developer Home/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Welcome back, Ada Lovelace/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("primary-View docs")).toHaveAttribute(
      "href",
      "/developers/documentation",
    );
    expect(screen.getByTestId("secondary-Contact support")).toHaveAttribute(
      "href",
      "/contact",
    );
  });

  test("shows fallback name when no user name is available", () => {
    useAuthStoreMock.mockReturnValue({
      session: createSession({}),
    });

    render(<DeveloperPortalHome />);

    expect(
      screen.getByRole("heading", { name: /Welcome back, Developer/i }),
    ).toBeInTheDocument();
  });

  test("uses email as fallback when name is not provided", () => {
    useAuthStoreMock.mockReturnValue({
      session: createSession({
        email: "test@example.com",
      }),
    });

    render(<DeveloperPortalHome />);

    expect(
      screen.getByRole("heading", { name: /Welcome back, test@example.com/i }),
    ).toBeInTheDocument();
  });
});
