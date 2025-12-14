import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import OrganizationList, {
  getStatusStyle,
} from "@/app/components/DataTable/OrganizationList";
import { useOrgStore } from "@/app/stores/orgStore";
import { useRouter } from "next/navigation";
import { OrgWithMembership } from "@/app/types/org";

// --- Mocks ---

// Mock Router
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

// Mock Store
jest.mock("@/app/stores/orgStore", () => ({
  useOrgStore: jest.fn(),
}));

// Mock GenericTable to test render props in columns
jest.mock("@/app/components/GenericTable/GenericTable", () => {
  return ({ data, columns }: any) => (
    <div data-testid="generic-table">
      {data.map((item: any, i: number) => (
        <div key={i} data-testid={`row-${i}`}>
          {columns.map((col: any) => (
            <div key={col.key} data-testid={`cell-${col.key}`}>
              {col.render ? col.render(item) : item[col.key]}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
});

// Fixed: Use absolute path alias to resolve OrgCard mock correctly
jest.mock("@/app/components/Cards/OrgCard/OrgCard", () => {
  return ({ org, handleOrgClick }: any) => (
    <div data-testid={`org-card-${org.org.name}`}>
      <button onClick={() => handleOrgClick(org)}>Select Card</button>
    </div>
  );
});

// --- Test Data ---

const mockVerifiedOrg: OrgWithMembership = {
  org: {
    _id: "org-1",
    name: "Verified Corp",
    type: "Medical",
    isVerified: true,
  },
  membership: {
    roleDisplay: "Owner",
  },
} as unknown as OrgWithMembership;

const mockUnverifiedOrg: OrgWithMembership = {
  org: {
    // Missing _id to test fallback logic: `org.org._id?.toString() || org.org.name`
    name: "Pending Inc",
    type: "Clinic",
    isVerified: false,
  },
  membership: {
    roleDisplay: "Staff",
  },
} as unknown as OrgWithMembership;

describe("OrganizationList Component", () => {
  const mockSetPrimaryOrg = jest.fn();
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ setPrimaryOrg: mockSetPrimaryOrg })
    );
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
  });

  // --- 1. Helper Function Tests ---

  describe("getStatusStyle", () => {
    it("returns correct style for 'Active'", () => {
      const style = getStatusStyle("Active");
      expect(style).toEqual({ color: "#54B492", backgroundColor: "#E6F4EF" });
    });

    it("returns correct style for 'active' (case insensitive)", () => {
      const style = getStatusStyle("active");
      expect(style).toEqual({ color: "#54B492", backgroundColor: "#E6F4EF" });
    });

    it("returns correct style for 'Pending'", () => {
      const style = getStatusStyle("Pending");
      expect(style).toEqual({ color: "#F68523", backgroundColor: "#FEF3E9" });
    });

    it("returns default style for unknown status", () => {
      const style = getStatusStyle("Unknown");
      expect(style).toEqual({ color: "#fff", backgroundColor: "#247AED" });
    });
  });

  // --- 2. Rendering Tests ---

  it("renders the table rows with correct data", () => {
    render(<OrganizationList orgs={[mockVerifiedOrg, mockUnverifiedOrg]} />);

    // Row 1 (Verified)
    expect(screen.getByText("Verified Corp")).toBeInTheDocument();
    expect(screen.getByText("Medical")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();

    // Status Logic for Verified: isVerified ? "Active" : "Pending"
    expect(screen.getByText("Active")).toBeInTheDocument();
    const activeBadge = screen.getByText("Active").closest("div");
    expect(activeBadge).toHaveStyle("background-color: #E6F4EF");

    // Row 2 (Unverified)
    expect(screen.getByText("Pending Inc")).toBeInTheDocument();
    expect(screen.getByText("Clinic")).toBeInTheDocument();
    expect(screen.getByText("Staff")).toBeInTheDocument();

    // Status Logic for Unverified
    expect(screen.getByText("Pending")).toBeInTheDocument();
    const pendingBadge = screen.getByText("Pending").closest("div");
    expect(pendingBadge).toHaveStyle("background-color: #FEF3E9");
  });

  it("renders mobile cards", () => {
    render(<OrganizationList orgs={[mockVerifiedOrg]} />);
    expect(screen.getByTestId("org-card-Verified Corp")).toBeInTheDocument();
  });

  // --- 3. Interaction Tests ---

  it("navigates to dashboard when clicking a verified org (Table)", () => {
    render(<OrganizationList orgs={[mockVerifiedOrg]} />);

    const nameButton = screen.getByText("Verified Corp");
    fireEvent.click(nameButton);

    expect(mockSetPrimaryOrg).toHaveBeenCalledWith("org-1");
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("navigates to create-org when clicking an unverified org (Table)", () => {
    render(<OrganizationList orgs={[mockUnverifiedOrg]} />);

    const nameButton = screen.getByText("Pending Inc");
    fireEvent.click(nameButton);

    // Should use fallback 'name' as ID since _id is missing
    expect(mockSetPrimaryOrg).toHaveBeenCalledWith("Pending Inc");
    expect(mockPush).toHaveBeenCalledWith("/create-org?orgId=Pending Inc");
  });

  it("navigates correctly when clicking a mobile card", () => {
    render(<OrganizationList orgs={[mockVerifiedOrg]} />);

    const cardButton = screen.getByText("Select Card");
    fireEvent.click(cardButton);

    expect(mockSetPrimaryOrg).toHaveBeenCalledWith("org-1");
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });
});
