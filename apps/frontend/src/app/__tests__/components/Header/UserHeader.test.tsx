import "../../../test-helpers/testMocks";

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: mockPush }),
}));

const mockSignout = jest.fn();
jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: () => ({ signout: mockSignout }),
}));

import UserHeader from "@/app/components/Header/UserHeader/UserHeader";

describe("UserHeader", () => {
  beforeEach(() => {
    mockPush.mockReset();
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

    fireEvent.click(orgButton!);
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
