import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/dashboard",
}));

const mockUseAuthStore = jest.fn();
jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: (selector?: any) =>
    selector ? selector(mockUseAuthStore()) : mockUseAuthStore(),
}));

import ProtectedRoute from "@/app/components/ProtectedRoute";

describe("ProtectedRoute", () => {
  beforeEach(() => {
    mockReplace.mockReset();
  });

  test("renders children when authenticated", () => {
    mockUseAuthStore.mockReturnValue({ status: "authenticated" });

    render(
      <ProtectedRoute>
        <div>Private content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("Private content")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  test("renders nothing while checking auth state", () => {
    mockUseAuthStore.mockReturnValue({ status: "checking" });

    const { container } = render(
      <ProtectedRoute>
        <div>Hidden</div>
      </ProtectedRoute>
    );

    expect(container).toBeEmptyDOMElement();
  });

  test("redirects unauthenticated users to signin", async () => {
    mockUseAuthStore.mockReturnValue({ status: "unauthenticated" });

    render(
      <ProtectedRoute>
        <div>Hidden</div>
      </ProtectedRoute>
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        "/signin?next=%2Fdashboard"
      );
    });
  });
});
