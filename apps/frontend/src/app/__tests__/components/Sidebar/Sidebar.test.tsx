import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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

jest.mock("next/link", () => {
  return ({ children, ...props }: any) => (
    <a {...props} data-link="true">
      {children}
    </a>
  );
});

import Sidebar from "@/app/components/Sidebar/Sidebar";

describe("Sidebar", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockSignout.mockReset();
  });

  test("highlights active route", () => {
    render(<Sidebar />);

    const dashboardLink = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboardLink).toHaveClass("route-active");
  });

  test("navigates when clicking non sign-out route", () => {
    render(<Sidebar />);

    fireEvent.click(screen.getByRole("link", { name: "Appointments" }));

    expect(mockPush).toHaveBeenCalledWith("#");
  });

  test("calls signout when clicking Sign out", () => {
    render(<Sidebar />);

    fireEvent.click(screen.getByRole("link", { name: "Sign out" }));
    expect(mockSignout).toHaveBeenCalled();
  });
});
