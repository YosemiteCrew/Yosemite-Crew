import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import Sidebar from "@/app/components/Sidebar/Sidebar";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/app/stores/authStore";
import { useOrgStore } from "@/app/stores/orgStore";
import { useOrgList, usePrimaryOrg } from "@/app/hooks/useOrgSelectors";

// --- Mocks ---

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} alt={props.alt || "mock-img"} />,
}));

// FIX: Modified Link mock to prevent JSDOM navigation issues
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, onClick, className }: any) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault(); // Force prevent default in mock to stop JSDOM navigation
        if (onClick) onClick(e);
      }}
      className={className}
      data-testid={`link-${href}`}
    >
      {children}
    </a>
  ),
}));

jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: jest.fn(),
}));

jest.mock("@/app/stores/orgStore", () => ({
  useOrgStore: jest.fn(),
}));

jest.mock("@/app/hooks/useOrgSelectors", () => ({
  useOrgList: jest.fn(),
  usePrimaryOrg: jest.fn(),
}));

jest.mock("@/app/hooks/useLoadOrg", () => ({ useLoadOrg: jest.fn() }));
jest.mock("@/app/hooks/useProfiles", () => ({ useLoadProfiles: jest.fn() }));
jest.mock("@/app/hooks/useAvailabiities", () => ({
  useLoadAvailabilities: jest.fn(),
}));
jest.mock("@/app/hooks/useSpecialities", () => ({
  useLoadSpecialitiesForPrimaryOrg: jest.fn(),
}));

describe("Sidebar Component", () => {
  const mockRouterPush = jest.fn();
  const mockRouterReplace = jest.fn();
  const mockSignout = jest.fn();
  const mockSetPrimaryOrg = jest.fn();

  const mockOrgs = [
    { _id: "org1", name: "Org One", imageURL: "/org1.png", isVerified: true },
    { _id: "org2", name: "Org Two", imageURL: null, isVerified: false },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    (useRouter as jest.Mock).mockReturnValue({
      push: mockRouterPush,
      replace: mockRouterReplace,
    });

    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      signout: mockSignout,
    });

    (useOrgStore as unknown as jest.Mock).mockImplementation(
      (selector: any) => {
        const state = {
          status: "loaded",
          setPrimaryOrg: mockSetPrimaryOrg,
        };
        return selector(state);
      }
    );

    (useOrgList as jest.Mock).mockReturnValue(mockOrgs);
    (usePrimaryOrg as jest.Mock).mockReturnValue(mockOrgs[0]);
    (usePathname as jest.Mock).mockReturnValue("/dashboard");
  });

  // --- 1. Rendering & Loading State ---

  it("renders nothing (empty div) while loading organizations initially", () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ status: "loading" })
    );
    (useOrgList as jest.Mock).mockReturnValue([]);

    const { container } = render(<Sidebar />);

    expect(container.firstChild).toHaveClass("sidebar");
    expect(container.firstChild).toBeEmptyDOMElement();
  });

  it("renders the sidebar with primary org and routes when loaded", () => {
    render(<Sidebar />);

    expect(screen.getByText("Org One")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Appointments")).toBeInTheDocument();
    expect(screen.getByText("Sign out")).toBeInTheDocument();
  });

  it("renders default image if primary org has no image", () => {
    (usePrimaryOrg as jest.Mock).mockReturnValue({
      ...mockOrgs[1],
      imageURL: null,
    });

    render(<Sidebar />);

    const img = screen.getByAltText("Logo");
    expect(img).toHaveAttribute("src", expect.stringContaining("ftafter.png"));
  });

  // --- 2. Route Logic (App vs Dev) ---

  it("renders Developer Portal routes when path starts with /developers", () => {
    (usePathname as jest.Mock).mockReturnValue("/developers/home");

    render(<Sidebar />);

    expect(screen.getByText("API Keys")).toBeInTheDocument();
    expect(screen.getByText("Website - Builder")).toBeInTheDocument();
    expect(screen.queryByText("Appointments")).not.toBeInTheDocument();
  });

  it("highlights the active route", () => {
    (usePathname as jest.Mock).mockReturnValue("/finance");

    render(<Sidebar />);

    const activeLink = screen.getByTestId("link-/finance");
    expect(activeLink).toHaveClass("route-active");
  });

  // --- 3. Organization Selector Interaction ---

  it("toggles organization dropdown on click", () => {
    render(<Sidebar />);

    expect(screen.queryByText("Org Two")).not.toBeInTheDocument();

    const toggleBtn = screen.getByText("Org One").closest("button");
    fireEvent.click(toggleBtn!);

    expect(screen.getByText("Org Two")).toBeInTheDocument();
    expect(screen.getByText("View all")).toBeInTheDocument();

    fireEvent.click(toggleBtn!);
    expect(screen.queryByText("Org Two")).not.toBeInTheDocument();
  });

  it("switches organization when an option is clicked", () => {
    render(<Sidebar />);

    fireEvent.click(screen.getByText("Org One").closest("button")!);
    fireEvent.click(screen.getByText("Org Two"));

    expect(mockSetPrimaryOrg).toHaveBeenCalledWith("org2");
    expect(mockRouterPush).toHaveBeenCalledWith("/dashboard");
    expect(screen.queryByText("Org Two")).not.toBeInTheDocument();
  });

  it("navigates to organizations page when 'View all' is clicked", () => {
    render(<Sidebar />);

    fireEvent.click(screen.getByText("Org One").closest("button")!);

    const viewAllLink = screen.getByText("View all");
    fireEvent.click(viewAllLink);

    expect(screen.queryByText("Org Two")).not.toBeInTheDocument();
  });

  // --- 4. Navigation & Auth Logic ---

  it("handles Sign Out correctly", async () => {
    render(<Sidebar />);

    const signoutLink = screen.getByText("Sign out");
    await act(async () => {
      fireEvent.click(signoutLink);
    });

    expect(mockSignout).toHaveBeenCalled();
    expect(mockRouterReplace).toHaveBeenCalledWith("/signin");
  });

  it("redirects to developer signin on signout if in dev portal", async () => {
    (usePathname as jest.Mock).mockReturnValue("/developers/home");
    render(<Sidebar />);

    const signoutLink = screen.getByText("Sign out");
    await act(async () => {
      fireEvent.click(signoutLink);
    });

    expect(mockRouterReplace).toHaveBeenCalledWith("/developers/signin");
  });

  it("navigates to route when clicked", () => {
    render(<Sidebar />);

    const dashboardLink = screen.getByText("Dashboard");
    fireEvent.click(dashboardLink);

    expect(mockRouterPush).toHaveBeenCalledWith("/dashboard");
  });

  // --- 5. Disabled State Logic ---

  it("disables verified-only routes if org is not verified", () => {
    (usePrimaryOrg as jest.Mock).mockReturnValue(mockOrgs[1]);

    render(<Sidebar />);

    const link = screen.getByTestId("link-/appointments");
    expect(link).toHaveClass("text-[#BFBFBE]!");

    fireEvent.click(link);
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it("disables routes if no primary org is selected", () => {
    (usePrimaryOrg as jest.Mock).mockReturnValue(null);

    render(<Sidebar />);

    const link = screen.getByTestId("link-/appointments");
    fireEvent.click(link);
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it("allows navigation for non-verified routes even if org is unverified", () => {
    (usePrimaryOrg as jest.Mock).mockReturnValue(mockOrgs[1]);

    render(<Sidebar />);

    const link = screen.getByTestId("link-/settings");
    fireEvent.click(link);
    expect(mockRouterPush).toHaveBeenCalledWith("/settings");
  });

  it("handles signout error gracefully", async () => {
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockSignout.mockImplementation(() => {
      throw new Error("Signout Failed");
    });

    render(<Sidebar />);

    const signoutLink = screen.getByText("Sign out");
    await act(async () => {
      fireEvent.click(signoutLink);
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      "⚠️ Cognito signout error:",
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });
});
