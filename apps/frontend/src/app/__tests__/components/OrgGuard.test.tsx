import React from "react";
import { render } from "@testing-library/react";
import OrgGuard from "@/app/components/OrgGuard";
import { useOrgStore } from "@/app/stores/orgStore";
import { useSpecialityStore } from "@/app/stores/specialityStore";
import { useAvailabilityStore } from "@/app/stores/availabilityStore";
import { useUserProfileStore } from "@/app/stores/profileStore";
import { computeOrgOnboardingStep } from "@/app/utils/orgOnboarding";

const mockRouter = { replace: jest.fn() };
const mockUsePathname = jest.fn(() => "/dashboard");
jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockUsePathname(),
}));

jest.mock("@/app/hooks/useTeam", () => ({ useLoadTeam: jest.fn() }));
jest.mock("@/app/hooks/useRooms", () => ({ useLoadRoomsForPrimaryOrg: jest.fn() }));
jest.mock("@/app/hooks/useAppointments", () => ({
  useLoadAppointmentsForPrimaryOrg: jest.fn(),
}));
jest.mock("@/app/hooks/useCompanion", () => ({ useLoadCompanionsForPrimaryOrg: jest.fn() }));
jest.mock("@/app/hooks/useDocuments", () => ({ useLoadDocumentsForPrimaryOrg: jest.fn() }));
jest.mock("@/app/hooks/useForms", () => ({ useLoadFormsForPrimaryOrg: jest.fn() }));

jest.mock("@/app/stores/orgStore", () => ({ useOrgStore: jest.fn() }));
jest.mock("@/app/stores/specialityStore", () => ({ useSpecialityStore: jest.fn() }));
jest.mock("@/app/stores/availabilityStore", () => ({ useAvailabilityStore: jest.fn() }));
jest.mock("@/app/stores/profileStore", () => ({ useUserProfileStore: jest.fn() }));

jest.mock("@/app/utils/orgOnboarding", () => ({
  computeOrgOnboardingStep: jest.fn(() => 3),
}));
jest.mock("@/app/utils/teamOnboarding", () => ({
  computeTeamOnboardingStep: jest.fn(() => 3),
}));

const mockUseOrgStore = useOrgStore as unknown as jest.Mock;
const mockUseSpecialityStore = useSpecialityStore as unknown as jest.Mock;
const mockUseAvailabilityStore = useAvailabilityStore as unknown as jest.Mock;
const mockUseProfileStore = useUserProfileStore as unknown as jest.Mock;

const buildOrgState = (overrides: any = {}) => ({
  status: "loaded",
  primaryOrgId: "org-1",
  orgsById: {
    "org-1": { _id: "org-1", isVerified: true },
  },
  membershipsByOrgId: {
    "org-1": { roleDisplay: "owner" },
  },
  ...overrides,
});

const baseSpecialityState = {
  status: "loaded",
  getSpecialitiesByOrgId: () => [],
};

const baseAvailabilityState = {
  status: "loaded",
  getAvailabilitiesByOrgId: () => [],
};

const baseProfileState = {
  profilesByOrgId: { "org-1": { id: "profile-1" } },
};

describe("OrgGuard", () => {
  const originalAuthGuard = process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD;

  beforeAll(() => {
    process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = "false";
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = originalAuthGuard;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseOrgStore.mockImplementation((selector: any) =>
      selector(buildOrgState())
    );
    mockUseSpecialityStore.mockImplementation((selector: any) =>
      selector(baseSpecialityState)
    );
    mockUseAvailabilityStore.mockImplementation((selector: any) =>
      selector(baseAvailabilityState)
    );
    mockUseProfileStore.mockImplementation((selector: any) =>
      selector(baseProfileState)
    );
  });

  it("renders children when checks pass", () => {
    const { getByText } = render(
      <OrgGuard>
        <div>allowed</div>
      </OrgGuard>
    );

    expect(getByText("allowed")).toBeInTheDocument();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("redirects to organizations when no primary org", () => {
    mockUseOrgStore.mockImplementation((selector: any) =>
      selector(buildOrgState({ primaryOrgId: null }))
    );
    render(
      <OrgGuard>
        <div>child</div>
      </OrgGuard>
    );
    expect(mockRouter.replace).toHaveBeenCalledWith("/organizations");
  });

  it("forces onboarding route when owner is unverified and onboarding incomplete", () => {
    (computeOrgOnboardingStep as jest.Mock).mockReturnValue(1);
    mockUseOrgStore.mockImplementation((selector: any) =>
      selector(
        buildOrgState({
          orgsById: { "org-1": { _id: "org-1", isVerified: false } },
        })
      )
    );

    render(
      <OrgGuard>
        <div>child</div>
      </OrgGuard>
    );

    expect(mockRouter.replace).toHaveBeenCalledWith("/create-org?orgId=org-1");
  });
});
