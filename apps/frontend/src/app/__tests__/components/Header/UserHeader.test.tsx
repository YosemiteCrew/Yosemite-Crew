import "../../../jest.mocks/testMocks";

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: mockPush, replace: mockReplace, prefetch: jest.fn() }),
}));

const mockSignout = jest.fn();
jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: () => ({ signout: mockSignout }),
}));

import UserHeader from "@/app/components/Header/UserHeader/UserHeader";

describe("UserHeader", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockReplace.mockReset();
    mockSignout.mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test("opens mobile menu and navigates", () => {
    render(<UserHeader />);

    fireEvent.click(screen.getByLabelText("Open menu"));
    const orgButton = screen
      .getAllByRole("button", { name: "Organisation" })
      .find((el) => el.classList.contains("mobile-menu-item-button"));
    expect(orgButton).toBeDefined();

    if (!orgButton) {
      throw new Error("Organisation button not found in mobile menu");
    }

    fireEvent.click(orgButton);
    act(() => {
      jest.advanceTimersByTime(400);
    });

    expect(mockPush).toHaveBeenCalledWith("/organizations");
  });

  test("signs out when clicking Sign out entry", () => {
    render(<UserHeader />);

    fireEvent.click(screen.getByLabelText("Open menu"));
    const signOutButton = screen.getByRole("button", { name: "Sign out" });
    fireEvent.click(signOutButton);

    act(() => {
      jest.advanceTimersByTime(400);
    });

    expect(mockSignout).toHaveBeenCalled();
  });
});
