import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const replaceMock = jest.fn();
const useAuthStoreMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

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

  test("shows loading state while auth status is checking", () => {
    useAuthStoreMock.mockReturnValue({
      status: "checking",
      session: null,
    });

    render(<DeveloperPortalHome />);
    expect(
      screen.getByText(/Loading your developer workspace/i),
    ).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  test("redirects unauthenticated users to sign-in", () => {
    useAuthStoreMock.mockReturnValue({
      status: "unauthenticated",
      session: null,
    });

    render(<DeveloperPortalHome />);
    expect(replaceMock).toHaveBeenCalledWith(
      "/developers/signin?next=/developers/home",
    );
  });

  test("renders developer home content when authenticated", () => {
    useAuthStoreMock.mockReturnValue({
      status: "authenticated",
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
      "/developers",
    );
    expect(screen.getByTestId("secondary-Contact support")).toHaveAttribute(
      "href",
      "/contact",
    );
  });
});
