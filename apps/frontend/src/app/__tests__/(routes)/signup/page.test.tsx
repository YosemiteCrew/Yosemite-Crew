import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import Page from "@/app/(routes)/signup/page";

// 1. Mock dependencies
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/app/stores/authStore";

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

// Mock the global auth store
jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: jest.fn(),
}));

// Mock the child SignUp component to isolate the page logic
jest.mock("@/app/pages/SignUp/SignUp", () => {
  return function MockSignUp() {
    return <div data-testid="mock-signup">SignUp Component</div>;
  };
});

describe("Signup Page", () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default router mock behavior
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
  });

  it("renders the SignUp component and does not redirect when status is not authenticated", () => {
    // Setup: User is unauthenticated (False branch of the if statement)
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      status: "unauthenticated",
    });

    render(<Page />);

    // Assert: Child component is rendered
    expect(screen.getByTestId("mock-signup")).toBeInTheDocument();

    // Assert: Router push was NOT called
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("redirects to /organizations when status is authenticated", async () => {
    // Setup: User is authenticated (True branch of the if statement)
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      status: "authenticated",
    });

    render(<Page />);

    // Assert: Verify the redirect logic inside useEffect works
    // We use waitFor because useEffect runs asynchronously after the render
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/organizations");
    });
  });
});
