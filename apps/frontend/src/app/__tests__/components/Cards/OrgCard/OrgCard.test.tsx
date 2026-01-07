import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import OrgCard from "@/app/components/Cards/OrgCard/OrgCard";
import { OrgWithMembership } from "@/app/types/org";

// --- Mocks ---

jest.mock("@/app/components/DataTable/OrganizationList", () => ({
  getStatusStyle: jest.fn(() => ({ color: "green" })),
}));

// --- Test Data ---

const mockOrg: OrgWithMembership = {
  org: {
    _id: "org-1",
    name: "Acme Corp",
    type: "Business",
    isVerified: true,
  },
  membership: {
    roleDisplay: "Admin",
  },
} as any;

describe("OrgCard Component", () => {
  const mockHandleClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering Details ---

  it("renders organization details correctly", () => {
    render(<OrgCard org={mockOrg} handleOrgClick={mockHandleClick} />);

    // Name (Title Button)
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();

    // Type
    expect(screen.getByText("Type :")).toBeInTheDocument();
    expect(screen.getByText("Business")).toBeInTheDocument();

    // Role
    expect(screen.getByText("Role :")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  // --- 2. Status Logic ---

  it("renders 'Active' status when organization is verified", () => {
    const verifiedOrg = {
      ...mockOrg,
      org: { ...mockOrg.org, isVerified: true },
    } as any;

    render(<OrgCard org={verifiedOrg} handleOrgClick={mockHandleClick} />);

    const statusBadge = screen.getByText("Active");
    expect(statusBadge).toBeInTheDocument();
    // JSDOM computes "green" to "rgb(0, 128, 0)"
    expect(statusBadge).toHaveStyle({ color: "rgb(0, 128, 0)" });
  });

  it("renders 'Pending' status when organization is not verified", () => {
    const pendingOrg = {
      ...mockOrg,
      org: { ...mockOrg.org, isVerified: false },
    } as any;

    render(<OrgCard org={pendingOrg} handleOrgClick={mockHandleClick} />);

    const statusBadge = screen.getByText("Pending");
    expect(statusBadge).toBeInTheDocument();
  });

  // --- 3. Interaction ---

  it("calls handleOrgClick when the title button is clicked", () => {
    render(<OrgCard org={mockOrg} handleOrgClick={mockHandleClick} />);

    const titleBtn = screen.getByText("Acme Corp");
    fireEvent.click(titleBtn);

    expect(mockHandleClick).toHaveBeenCalledTimes(1);
    expect(mockHandleClick).toHaveBeenCalledWith(mockOrg);
  });

  // --- 4. Edge Cases ---

  it("handles missing membership role gracefully", () => {
    const orgNoRole = { ...mockOrg, membership: null } as any;

    render(<OrgCard org={orgNoRole} handleOrgClick={mockHandleClick} />);

    // Renders "Role :" label but value is empty
    expect(screen.getByText("Role :")).toBeInTheDocument();
  });
});
