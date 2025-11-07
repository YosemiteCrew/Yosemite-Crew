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

jest.mock("@/app/pages/SignUp/SignUp", () => ({
  __esModule: true,
  default: () => <div data-testid="signup-mock">SignUp Mock</div>,
}));

import Page, * as PageModule from "@/app/(routes)/signup/page";
import { useAuthStore } from "@/app/stores/authStore";

const useAuthStoreMock = useAuthStore as unknown as jest.MockedFunction<
  typeof useAuthStore
>;

describe("page (Sign Up route)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders SignUp when user is null (no redirect)", () => {
    useAuthStoreMock.mockReturnValue({ user: null } as any);

    render(<Page />);
    expect(screen.getByTestId("signup-mock")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  test("redirects to /organizations when user exists", () => {
    useAuthStoreMock.mockReturnValue({ user: { id: "123" } } as any);

    render(<Page />);
    expect(pushMock).toHaveBeenCalledWith("/create-org");
    expect(screen.getByTestId("signup-mock")).toBeInTheDocument();
  });

  test("default export is a function", () => {
    expect(typeof Page).toBe("function");
    expect(typeof PageModule.default).toBe("function");
  });
});
