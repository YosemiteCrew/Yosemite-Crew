import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import UserHeader from "@/app/components/Header/UserHeader/UserHeader";
import { usePathname, useRouter } from "next/navigation";

// --- Mocks ---

// Mock Next.js hooks
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}));

// Mock Auth Hook
const mockSignOut = jest.fn();
jest.mock("@/app/hooks/useAuth", () => ({
  useSignOut: jest.fn(() => ({
    signOut: mockSignOut,
  })),
}));

// Mock Next/Link
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} data-testid="next-link">
      {children}
    </a>
  ),
}));

// Mock Next/Image
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="next-image" />
  ),
}));

// Mock Icons
jest.mock("react-icons/md", () => ({
  MdNotificationsActive: () => <svg data-testid="notification-icon" />,
}));

describe("UserHeader Component", () => {
  const mockPush = jest.fn();
  const mockReplace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      replace: mockReplace,
    });
  });

  // --- 1. Initial Render (App Routes) ---

  it("renders the header correctly for normal app routes", () => {
    (usePathname as jest.Mock).mockReturnValue("/dashboard");

    render(<UserHeader />);

    // Logo check
    expect(screen.getByTestId("next-link")).toHaveAttribute("href", "/");

    // Notification Icon
    expect(screen.getByTestId("notification-icon")).toBeInTheDocument();

    // Menu Toggle Button (Hamburger)
    expect(screen.getByLabelText("Open menu")).toBeInTheDocument();
  });

  // --- 2. Menu Interaction & Navigation ---

  it("opens the menu and displays App routes", async () => {
    (usePathname as jest.Mock).mockReturnValue("/dashboard");
    render(<UserHeader />);

    const toggleBtn = screen.getByLabelText("Open menu");

    // Open menu
    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    // Check App Routes are visible
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Organization")).toBeInTheDocument();
    expect(screen.getByText("Appointments")).toBeInTheDocument();
    expect(screen.getByText("Sign out")).toBeInTheDocument();

    // Verify toggle button state changes
    expect(screen.getByLabelText("Close menu")).toBeInTheDocument();
  });

  it("opens the menu and displays Developer routes when path starts with /developers", async () => {
    (usePathname as jest.Mock).mockReturnValue("/developers/home");
    render(<UserHeader />);

    const toggleBtn = screen.getByLabelText("Open menu");

    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    // Check Developer Routes are visible
    expect(screen.getByText("API Keys")).toBeInTheDocument();
    expect(screen.getByText("Website - Builder")).toBeInTheDocument();
    expect(screen.getByText("Documentation")).toBeInTheDocument();

    // Ensure standard app routes are NOT visible (e.g. "Finance")
    expect(screen.queryByText("Finance")).not.toBeInTheDocument();
  });

  // --- 3. Sign Out Logic ---

  it("handles Sign out correctly for App users", async () => {
    jest.useFakeTimers();
    (usePathname as jest.Mock).mockReturnValue("/dashboard");
    render(<UserHeader />);

    // Open Menu
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Open menu"));
    });

    const signOutBtn = screen.getByText("Sign out");

    // Click Sign Out
    await act(async () => {
      fireEvent.click(signOutBtn);
    });

    // Fast-forward delay
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    // Wait for async sign out logic
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith("/signin");
    });

    jest.useRealTimers();
  });

  it("handles Sign out correctly for Developer users (redirects to dev signin)", async () => {
    jest.useFakeTimers();
    (usePathname as jest.Mock).mockReturnValue("/developers/home");
    render(<UserHeader />);

    // Open Menu
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Open menu"));
    });

    const signOutBtn = screen.getByText("Sign out");

    await act(async () => {
      fireEvent.click(signOutBtn);
    });

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith("/developers/signin");
    });

    jest.useRealTimers();
  });

  it("handles Sign out errors gracefully", async () => {
    jest.useFakeTimers();
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockSignOut.mockRejectedValueOnce(new Error("Sign out failed"));

    (usePathname as jest.Mock).mockReturnValue("/dashboard");
    render(<UserHeader />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Open menu"));
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Sign out"));
    });

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      // Should log error but not crash
      expect(consoleSpy).toHaveBeenCalledWith(
        "⚠️ Cognito signout error:",
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
    jest.useRealTimers();
  });
});
