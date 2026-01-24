"use client";
import React from "react";
import { render, screen } from "@testing-library/react";

const pushMock = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: jest.fn(),
}));

jest.mock("@/app/pages/ForgotPassword/ForgotPassword", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="forgotpassword-mock">ForgotPasswordPage Mock</div>
  ),
}));

import { useAuthStore } from "@/app/stores/authStore";
import Page, * as PageModule from "@/app/(routes)/(public)/forgot-password/page";

const useAuthStoreMock = useAuthStore as unknown as jest.MockedFunction<
  typeof useAuthStore
>;

describe("page (Forgot Password route)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders ForgotPasswordPage", () => {
    useAuthStoreMock.mockReturnValue({ user: null });

    render(<Page />);
    expect(screen.getByTestId("forgotpassword-mock")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  test("redirects to /organizations if user is logged in", () => {
    useAuthStoreMock.mockReturnValue({ user: { id: "123" } });

    render(<Page />);
    expect(pushMock).toHaveBeenCalledWith("/organizations");
  });

  test("renders ForgotPasswordPage even if redirect occurs", () => {
    useAuthStoreMock.mockReturnValue({ user: { id: "123" } });

    render(<Page />);
    expect(screen.getByTestId("forgotpassword-mock")).toBeInTheDocument();
  });

  test("default export is a function", () => {
    expect(typeof Page).toBe("function");
    expect(typeof PageModule.default).toBe("function");
  });
});
