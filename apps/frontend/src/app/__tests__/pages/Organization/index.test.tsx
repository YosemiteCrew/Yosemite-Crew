import React from "react";
import { render, screen } from "@testing-library/react";
import ProtectedOrganizations from "@/app/pages/Organization/index";
import { usePrimaryOrg } from "@/app/hooks/useOrgSelectors";

// --- Mocks ---

// Mock Hooks
jest.mock("@/app/hooks/useOrgSelectors", () => ({
  usePrimaryOrg: jest.fn(),
}));

// Mock Guards
jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

jest.mock("@/app/components/OrgGuard", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="org-guard">{children}</div>
  ),
}));

// Mock Sub-sections
jest.mock("@/app/pages/Organization/Sections/index", () => ({
  Profile: ({ primaryOrg }: any) => (
    <div data-testid="section-profile">{primaryOrg.name}</div>
  ),
  Specialities: () => <div data-testid="section-specialities" />,
  Rooms: () => <div data-testid="section-rooms" />,
  Team: () => <div data-testid="section-team" />,
  Payment: () => <div data-testid="section-payment" />,
  Documents: () => <div data-testid="section-documents" />,
  Delete: () => <div data-testid="section-delete" />,
}));

describe("Organization Page Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Guard & Wrapper Logic ---

  it("should be wrapped in ProtectedRoute and OrgGuard", () => {
    (usePrimaryOrg as jest.Mock).mockReturnValue({
      name: "Test Org",
      isVerified: false,
    });

    render(<ProtectedOrganizations />);

    expect(screen.getByTestId("protected-route")).toBeInTheDocument();
    expect(screen.getByTestId("org-guard")).toBeInTheDocument();
  });

  // --- 2. Initial State & Null Checks ---

  it("renders nothing (null) if primaryorg is not available", () => {
    (usePrimaryOrg as jest.Mock).mockReturnValue(null);

    const { container } = render(<ProtectedOrganizations />);

    // Within OrgGuard, the Organization component is called.
    // If it returns null, the container inside the guard should be empty of the main div.
    expect(container.querySelector(".flex-col")).not.toBeInTheDocument();
  });

  // --- 3. Conditional Rendering (Unverified) ---

  it("renders only Profile, Specialities, and Delete for unverified organizations", () => {
    const mockOrg = { name: "Unverified Clinic", isVerified: false };
    (usePrimaryOrg as jest.Mock).mockReturnValue(mockOrg);

    render(<ProtectedOrganizations />);

    // Basic sections
    expect(screen.getByTestId("section-profile")).toHaveTextContent(
      "Unverified Clinic"
    );
    expect(screen.getByTestId("section-specialities")).toBeInTheDocument();
    expect(screen.getByTestId("section-delete")).toBeInTheDocument();

    // Advanced sections should NOT be rendered
    expect(screen.queryByTestId("section-team")).not.toBeInTheDocument();
    expect(screen.queryByTestId("section-rooms")).not.toBeInTheDocument();
    expect(screen.queryByTestId("section-payment")).not.toBeInTheDocument();
    expect(screen.queryByTestId("section-documents")).not.toBeInTheDocument();
  });

  // --- 4. Conditional Rendering (Verified) ---

  it("renders all sections for verified organizations", () => {
    const mockOrg = { name: "Verified Hospital", isVerified: true };
    (usePrimaryOrg as jest.Mock).mockReturnValue(mockOrg);

    render(<ProtectedOrganizations />);

    // Basic sections
    expect(screen.getByTestId("section-profile")).toBeInTheDocument();
    expect(screen.getByTestId("section-specialities")).toBeInTheDocument();
    expect(screen.getByTestId("section-delete")).toBeInTheDocument();

    // Advanced sections SHOULD be rendered
    expect(screen.getByTestId("section-team")).toBeInTheDocument();
    expect(screen.getByTestId("section-rooms")).toBeInTheDocument();
    expect(screen.getByTestId("section-payment")).toBeInTheDocument();
    expect(screen.getByTestId("section-documents")).toBeInTheDocument();
  });
});
