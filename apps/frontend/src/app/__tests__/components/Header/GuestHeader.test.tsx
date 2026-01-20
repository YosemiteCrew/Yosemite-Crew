import "../../../jest.mocks/testMocks";

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockPathname = jest.fn();
const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: mockPush }),
}));

const mockUseAuthStore = jest.fn();
jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

import GuestHeader from "@/app/components/Header/GuestHeader/GuestHeader";

describe("GuestHeader", () => {
  beforeEach(() => {
    mockPush.mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test("shows CTA based on auth state", () => {
    mockPathname.mockReturnValue("/pricing");
    mockUseAuthStore.mockReturnValue({ user: { id: "123" } });

    render(<GuestHeader />);

    const ctas = screen.getAllByTestId("primary-btn");
    expect(ctas[0]).toHaveTextContent("Go to app");
    expect(ctas[0]).toHaveAttribute("href", "/organizations");
  });

  test("hides CTA on auth routes", () => {
    mockPathname.mockReturnValue("/signin");
    mockUseAuthStore.mockReturnValue({ user: null });

    render(<GuestHeader />);
    expect(screen.queryByTestId("primary-btn")).not.toBeInTheDocument();
  });
});
