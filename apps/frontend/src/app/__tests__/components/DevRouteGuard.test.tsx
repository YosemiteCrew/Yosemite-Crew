import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const replaceMock = jest.fn();
const signoutMock = jest.fn();
const useAuthStoreMock = jest.fn();
let mockPathname = "/developers/home";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => mockPathname,
}));

jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: () => useAuthStoreMock(),
}));

import DevRouteGuard from "@/app/components/DevRouteGuard/DevRouteGuard";

describe("<DevRouteGuard />", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = "/developers/home";
  });

  test("allows access for developer role on developer paths", async () => {
    useAuthStoreMock.mockReturnValue({
      status: "authenticated",
      role: "developer",
      signout: signoutMock,
    });

    render(
      <DevRouteGuard>
        <div data-testid="allowed-content">content</div>
      </DevRouteGuard>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("allowed-content")).toBeInTheDocument(),
    );
    expect(replaceMock).not.toHaveBeenCalled();
  });

  test("redirects unauthenticated users on developer paths", async () => {
    useAuthStoreMock.mockReturnValue({
      status: "unauthenticated",
      role: undefined,
      signout: signoutMock,
    });

    render(
      <DevRouteGuard>
        <div data-testid="blocked-content">content</div>
      </DevRouteGuard>,
    );

    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith("/developers/signin"),
    );
    expect(screen.queryByTestId("blocked-content")).not.toBeInTheDocument();
  });

  test("signs out and redirects when authenticated but not developer", async () => {
    useAuthStoreMock.mockReturnValue({
      status: "authenticated",
      role: "member",
      signout: signoutMock,
    });

    render(
      <DevRouteGuard>
        <div data-testid="blocked-content">content</div>
      </DevRouteGuard>,
    );

    await waitFor(() => {
      expect(signoutMock).toHaveBeenCalled();
      expect(replaceMock).toHaveBeenCalledWith("/developers/signin");
    });
    expect(screen.queryByTestId("blocked-content")).not.toBeInTheDocument();
  });

  test("allows non-developer routes to render", async () => {
    mockPathname = "/pricing";
    useAuthStoreMock.mockReturnValue({
      status: "authenticated",
      role: "member",
      signout: signoutMock,
    });

    render(
      <DevRouteGuard>
        <div data-testid="public-content">content</div>
      </DevRouteGuard>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("public-content")).toBeInTheDocument(),
    );
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
