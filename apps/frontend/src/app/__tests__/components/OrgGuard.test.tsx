import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import OrgGuard from "@/app/components/OrgGuard";
import { useOrgStore } from "@/app/stores/orgStore";
import { useSpecialityStore } from "@/app/stores/specialityStore";
import { useAvailabilityStore } from "@/app/stores/availabilityStore";
import { useUserProfileStore } from "@/app/stores/profileStore";
import { useRouter, usePathname } from "next/navigation";
import * as orgOnboardingUtils from "@/app/utils/orgOnboarding";
import * as teamOnboardingUtils from "@/app/utils/teamOnboarding";

// --- Mocks ---

// Navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

// Stores
jest.mock("@/app/stores/orgStore");
jest.mock("@/app/stores/specialityStore");
jest.mock("@/app/stores/availabilityStore");
jest.mock("@/app/stores/profileStore");

// Side Effect Hooks (just mock them to do nothing)
jest.mock("@/app/hooks/useLoadOrg", () => ({ useLoadOrg: jest.fn() }));
jest.mock("@/app/hooks/useSpecialities", () => ({
  useLoadSpecialitiesForPrimaryOrg: jest.fn(),
}));
jest.mock("@/app/hooks/useTeam", () => ({ useLoadTeam: jest.fn() }));
jest.mock("@/app/hooks/useProfiles", () => ({ useLoadProfiles: jest.fn() }));
jest.mock("@/app/hooks/useAvailabiities", () => ({
  useLoadAvailabilities: jest.fn(),
}));

// Utils
jest.mock("@/app/utils/orgOnboarding", () => ({
  computeOrgOnboardingStep: jest.fn(),
}));
jest.mock("@/app/utils/teamOnboarding", () => ({
  computeTeamOnboardingStep: jest.fn(),
}));

describe("OrgGuard Component", () => {
  const mockReplace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Router Mocks
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
    (usePathname as jest.Mock).mockReturnValue("/dashboard");

    // Default Store States (Loaded & Happy Path)
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        status: "loaded",
        primaryOrgId: "org-1",
        orgsById: { "org-1": { _id: "org-1", isVerified: true } },
        membershipsByOrgId: { "org-1": { roleCode: "OWNER" } },
      })
    );

    (useSpecialityStore as unknown as jest.Mock).mockImplementation(
      (selector: any) =>
        selector({
          status: "loaded",
          getSpecialitiesByOrgId: jest.fn(() => []),
        })
    );

    (useAvailabilityStore as unknown as jest.Mock).mockImplementation(
      (selector: any) =>
        selector({
          status: "loaded",
          getAvailabilitiesByOrgId: jest.fn(() => []),
        })
    );

    (useUserProfileStore as unknown as jest.Mock).mockImplementation(
      (selector: any) =>
        selector({
          profilesByOrgId: { "org-1": {} },
        })
    );

    // Default Utils logic (Steps completed)
    (orgOnboardingUtils.computeOrgOnboardingStep as jest.Mock).mockReturnValue(
      3
    );
    (
      teamOnboardingUtils.computeTeamOnboardingStep as jest.Mock
    ).mockReturnValue(3);
  });

  // --- 1. Loading States ---

  it("renders nothing while stores are loading", () => {
    // Override store to return loading status
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ status: "loading" })
    );

    const { container } = render(
      <OrgGuard>
        <div data-testid="child">Child</div>
      </OrgGuard>
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
  });

  it("renders nothing if speciality store is idle", () => {
    (useSpecialityStore as unknown as jest.Mock).mockImplementation(
      (selector: any) => selector({ status: "idle" })
    );
    const { container } = render(
      <OrgGuard>
        <div data-testid="child">Child</div>
      </OrgGuard>
    );
    expect(container).toBeEmptyDOMElement();
  });

  // --- 2. Missing Org / Membership ---

  it("redirects to /organizations if no primary org is selected", () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        status: "loaded",
        primaryOrgId: null, // No org
      })
    );

    render(
      <OrgGuard>
        <div data-testid="child">Child</div>
      </OrgGuard>
    );

    expect(mockReplace).toHaveBeenCalledWith("/organizations");
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
  });

  it("does NOT redirect if already on /organizations with no org", () => {
    (usePathname as jest.Mock).mockReturnValue("/organizations");
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        status: "loaded",
        primaryOrgId: null,
      })
    );

    render(
      <OrgGuard>
        <div data-testid="child">Child</div>
      </OrgGuard>
    );

    expect(mockReplace).not.toHaveBeenCalled();
    // It returns undefined in the check `if (!primaryOrgId...) return;` so it renders nothing?
    // The code says: `if (!primaryOrgId...) { ... return; }`.
    // And `if (!checked) return null;` at the end.
    // Since it returns early, `setChecked(true)` is never called.
    // So it renders null. Correct.
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
  });

  // --- 3. Owner Logic ---

  it("redirects Owner to /create-org if org is not verified and step < 3", () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        status: "loaded",
        primaryOrgId: "org-1",
        orgsById: { "org-1": { _id: "org-1", isVerified: false } }, // Unverified
        membershipsByOrgId: { "org-1": { roleCode: "OWNER" } },
      })
    );
    (orgOnboardingUtils.computeOrgOnboardingStep as jest.Mock).mockReturnValue(
      1
    ); // Step 1

    render(
      <OrgGuard>
        <div data-testid="child">Child</div>
      </OrgGuard>
    );

    expect(mockReplace).toHaveBeenCalledWith("/create-org?orgId=org-1");
  });

  it("redirects Owner to /dashboard if unverified but steps are complete (step 3)", () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        status: "loaded",
        primaryOrgId: "org-1",
        orgsById: { "org-1": { _id: "org-1", isVerified: false } },
        membershipsByOrgId: { "org-1": { roleCode: "OWNER" } },
      })
    );
    (orgOnboardingUtils.computeOrgOnboardingStep as jest.Mock).mockReturnValue(
      3
    );

    render(
      <OrgGuard>
        <div data-testid="child">Child</div>
      </OrgGuard>
    );
  });

  it("allows Owner on /organization page if unverified but steps complete", () => {
    // This tests the specific `pathname === "/organization"` branch
    (usePathname as jest.Mock).mockReturnValue("/organization");
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        status: "loaded",
        primaryOrgId: "org-1",
        orgsById: { "org-1": { _id: "org-1", isVerified: false } },
        membershipsByOrgId: { "org-1": { roleCode: "OWNER" } },
      })
    );
    (orgOnboardingUtils.computeOrgOnboardingStep as jest.Mock).mockReturnValue(
      3
    );

    render(
      <OrgGuard>
        <div data-testid="child">Child</div>
      </OrgGuard>
    );

    // redirectTo would be "/organization", which equals pathname.
    // So logic `if (redirectTo && redirectTo !== pathname)` is false.
    // It proceeds to `setChecked(true)` and renders children.
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders children for Owner if Verified (Happy Path)", () => {
    // Defaults from beforeEach are: Verified, Owner.
    render(
      <OrgGuard>
        <div data-testid="child">Child</div>
      </OrgGuard>
    );

    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  // --- 4. Member Logic ---

  it("redirects Member to /team-onboarding if profile step < 3", () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        status: "loaded",
        primaryOrgId: "org-1",
        orgsById: { "org-1": { _id: "org-1", isVerified: true } },
        membershipsByOrgId: { "org-1": { roleCode: "MEMBER" } }, // Member
      })
    );
    (
      teamOnboardingUtils.computeTeamOnboardingStep as jest.Mock
    ).mockReturnValue(1); // Incomplete

    render(
      <OrgGuard>
        <div data-testid="child">Child</div>
      </OrgGuard>
    );

    expect(mockReplace).toHaveBeenCalledWith("/team-onboarding?orgId=org-1");
  });

  it("renders children for Member if profile is complete", () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        status: "loaded",
        primaryOrgId: "org-1",
        orgsById: { "org-1": { _id: "org-1", isVerified: true } },
        membershipsByOrgId: { "org-1": { roleCode: "MEMBER" } },
      })
    );
    (
      teamOnboardingUtils.computeTeamOnboardingStep as jest.Mock
    ).mockReturnValue(3); // Complete

    render(
      <OrgGuard>
        <div data-testid="child">Child</div>
      </OrgGuard>
    );

    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("Does not redirect Member from /organizations even if profile incomplete", () => {
    (usePathname as jest.Mock).mockReturnValue("/organizations");
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        status: "loaded",
        primaryOrgId: "org-1",
        orgsById: { "org-1": { _id: "org-1" } },
        membershipsByOrgId: { "org-1": { roleCode: "MEMBER" } },
      })
    );
    (
      teamOnboardingUtils.computeTeamOnboardingStep as jest.Mock
    ).mockReturnValue(1);

    render(
      <OrgGuard>
        <div data-testid="child">Child</div>
      </OrgGuard>
    );

    expect(mockReplace).not.toHaveBeenCalled();
    // Should render because no redirect triggered
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});
