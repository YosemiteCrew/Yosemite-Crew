import React from "react";
import { render, screen } from "@testing-library/react";
import SessionInitializer from "@/app/components/SessionInitializer";
import { useAuthStore } from "@/app/stores/authStore";

jest.mock("@/app/components/Header/Header", () => () => (
  <div data-testid="header" />
));
jest.mock("@/app/components/Sidebar/Sidebar", () => () => (
  <div data-testid="sidebar" />
));

jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: Object.assign(jest.fn(), {
    getState: jest.fn(),
  }),
}));

const mockUseAuthStore = useAuthStore as unknown as jest.Mock;
const mockGetState = (useAuthStore as any).getState as jest.Mock;

describe("SessionInitializer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetState.mockReturnValue({ checkSession: jest.fn() });
  });

  it("hides private children while checking session", () => {
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({ status: "checking" })
    );

    render(
      <SessionInitializer>
        <div data-testid="child" />
      </SessionInitializer>
    );

    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
    expect(mockGetState).toHaveBeenCalled(); // checkSession triggered via effect
  });

  it("shows private children once authenticated", () => {
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({ status: "authenticated" })
    );

    render(
      <SessionInitializer>
        <div data-testid="child" />
      </SessionInitializer>
    );

    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});
