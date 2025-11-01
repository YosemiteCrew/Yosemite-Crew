"use client";
import React from "react";
import { render, screen } from "@testing-library/react";

const pushMock = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

jest.mock("@/app/stores/authStore", () => ({
  __esModule: true,
  useAuthStore: jest.fn(),
}));

jest.mock("@/app/pages/SignIn/SignIn", () => ({
  __esModule: true,
  default: () => <div data-testid="signin-mock">SignIn Mock</div>,
}));

import Page, * as PageModule from "@/app/(routes)/signin/page";
import { useAuthStore } from "@/app/stores/authStore";

const useAuthStoreMock = useAuthStore as unknown as jest.MockedFunction<
  typeof useAuthStore
>;

describe("page (Sign In route)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders SignIn when user is null (no redirect)", () => {
    useAuthStoreMock.mockReturnValue({ user: null } as any);

    render(<Page />);
    expect(screen.getByTestId("signin-mock")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  test("redirects to /organizations when user exists", () => {
    useAuthStoreMock.mockReturnValue({ user: { id: "123" } } as any);

    render(<Page />);
    expect(pushMock).toHaveBeenCalledWith("/organizations");
    expect(screen.getByTestId("signin-mock")).toBeInTheDocument();
  });

  test("default export is a function", () => {
    expect(typeof Page).toBe("function");
    expect(typeof PageModule.default).toBe("function");
  });
});
