import React from "react";
import { render } from "@testing-library/react";
import DevRouteGuard from "@/app/components/DevRouteGuard/DevRouteGuard";
import { useAuthStore } from "@/app/stores/authStore";

const mockReplace = jest.fn();
const mockUsePathname = jest.fn(() => "/developers/home");
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockUsePathname(),
}));

jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: jest.fn(),
}));

const mockUseAuthStore = useAuthStore as unknown as jest.Mock;

describe("DevRouteGuard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthStore.mockImplementation(() =>
      ({
        status: "authenticated",
        role: "developer",
        signout: jest.fn(),
      } as any)
    );
  });

  it("renders children for developer role", () => {
    const { getByText } = render(
      <DevRouteGuard>
        <div>child</div>
      </DevRouteGuard>
    );
    expect(getByText("child")).toBeInTheDocument();
  });

  it("redirects unauthenticated developer path", () => {
    mockUseAuthStore.mockImplementation(() => ({
      status: "unauthenticated",
      role: null,
      signout: jest.fn(),
    }));

    render(
      <DevRouteGuard>
        <div>child</div>
      </DevRouteGuard>
    );
    expect(mockReplace).toHaveBeenCalledWith("/developers/signin");
  });

  it("signs out and redirects if authenticated without developer role", () => {
    const signout = jest.fn();
    mockUseAuthStore.mockImplementation(() => ({
      status: "authenticated",
      role: "user",
      signout,
    }));

    render(
      <DevRouteGuard>
        <div>child</div>
      </DevRouteGuard>
    );
    expect(signout).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/developers/signin");
  });
});
