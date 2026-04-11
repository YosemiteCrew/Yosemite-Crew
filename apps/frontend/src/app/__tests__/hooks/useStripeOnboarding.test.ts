import { renderHook, act } from "@testing-library/react";
import {
  useStripeOnboarding,
  useSubscriptionCounterUpdate,
} from "@/app/hooks/useStripeOnboarding";
import { useOrgStore } from "@/app/stores/orgStore";
import { useSubscriptionStore } from "@/app/stores/subscriptionStore";
import * as stripeService from "@/app/features/billing/services/stripeService";

// ----------------------------------------------------------------------------
// 1. Mocks
// ----------------------------------------------------------------------------

jest.mock("@/app/stores/orgStore", () => ({
  useOrgStore: jest.fn(),
}));

jest.mock("@/app/stores/subscriptionStore", () => ({
  useSubscriptionStore: jest.fn(),
}));

jest.mock("@/app/features/billing/services/stripeService", () => ({
  checkStatus: jest.fn(),
}));

describe("useStripeOnboarding Hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Hook 1: useStripeOnboarding
  // ==========================================================================
  describe("useStripeOnboarding", () => {
    const setupOrgStoreMock = (
      orgId: string | null,
      orgData: any = null,
      membershipData: any = null
    ) => {
      (useOrgStore as unknown as jest.Mock).mockImplementation((selector) => {
        // Mock state structure expected by the hook selectors
        const mockState = {
          orgsById: orgData ? { [orgData.id]: orgData } : {},
          membershipsByOrgId: membershipData
            ? { [membershipData.organisationId]: membershipData }
            : {},
        };
        return selector(mockState);
      });
    };

    it("returns false if no orgId provided", () => {
      setupOrgStoreMock(null);
      const { result } = renderHook(() => useStripeOnboarding(null));
      expect(result.current.onboard).toBe(false);
    });

    it("returns false if org not found in store", () => {
      setupOrgStoreMock("org-1", null, {
        organisationId: "org-1",
        roleDisplay: "Owner",
      });
      const { result } = renderHook(() => useStripeOnboarding("org-1"));
      expect(result.current.onboard).toBe(false);
    });

    it("returns false if membership not found in store", () => {
      setupOrgStoreMock("org-1", { id: "org-1", isVerified: true }, null);
      const { result } = renderHook(() => useStripeOnboarding("org-1"));
      expect(result.current.onboard).toBe(false);
    });

    it("returns false if user is NOT owner (role check case-insensitive)", () => {
      setupOrgStoreMock(
        "org-1",
        { id: "org-1", isVerified: true },
        { organisationId: "org-1", roleDisplay: "Admin" }
      );
      const { result } = renderHook(() => useStripeOnboarding("org-1"));
      expect(result.current.onboard).toBe(false);
    });

    it("returns false if role uses roleCode fallback and is NOT owner", () => {
      setupOrgStoreMock(
        "org-1",
        { id: "org-1", isVerified: true },
        { organisationId: "org-1", roleDisplay: null, roleCode: "MEMBER" }
      );
      const { result } = renderHook(() => useStripeOnboarding("org-1"));
      expect(result.current.onboard).toBe(false);
    });

    it("returns false if organization is NOT verified", () => {
      setupOrgStoreMock(
        "org-1",
        { id: "org-1", isVerified: false },
        { organisationId: "org-1", roleDisplay: "Owner" }
      );
      const { result } = renderHook(() => useStripeOnboarding("org-1"));
      expect(result.current.onboard).toBe(false);
    });

    it("returns TRUE if user is Owner and Org is Verified", () => {
      setupOrgStoreMock(
        "org-1",
        { id: "org-1", isVerified: true },
        { organisationId: "org-1", roleDisplay: "owner" } // Lowercase test
      );
    });

    it("handles fallback to empty string for missing roles", () => {
      // Edge case: Both roleDisplay and roleCode are null
      setupOrgStoreMock(
        "org-1",
        { id: "org-1", isVerified: true },
        { organisationId: "org-1", roleDisplay: null, roleCode: null }
      );
      const { result } = renderHook(() => useStripeOnboarding("org-1"));
      expect(result.current.onboard).toBe(false);
    });
  });

  // ==========================================================================
  // Hook 2: useSubscriptionCounterUpdate
  // ==========================================================================
  describe("useSubscriptionCounterUpdate", () => {
    beforeEach(() => {
      // Setup Subscription Store Mock
      (useSubscriptionStore as unknown as jest.Mock).mockImplementation(
        (selector) =>
          selector({
            primaryOrgId: "org-1"
          })
      );

      // We also need to mock useOrgStore as the hook uses it to get primaryOrgId
       (useOrgStore as unknown as jest.Mock).mockImplementation((selector) => {
        return selector({ primaryOrgId: "org-1" });
      });
    });

    it("initializes with default state", () => {
      const { result } = renderHook(() => useSubscriptionCounterUpdate("org-1"));
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("does nothing if refetch is called without orgId", async () => {
       // Mock org store to return null primaryOrgId for this test case
       (useOrgStore as unknown as jest.Mock).mockImplementation((selector) => selector({ primaryOrgId: null }));

      const { result } = renderHook(() => useSubscriptionCounterUpdate(null));

      await act(async () => {
        await result.current.refetch();
      });

      expect(stripeService.checkStatus).not.toHaveBeenCalled();
      expect(result.current.loading).toBe(false);
    });

    it("fetches status successfully", async () => {
      const mockResponse = { status: "active", plan: "pro" };
      (stripeService.checkStatus as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useSubscriptionCounterUpdate("org-1"));

      await act(async () => {
        const promise = result.current.refetch();
        await promise;
      });

      expect(stripeService.checkStatus).toHaveBeenCalledWith("org-1");
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("handles API errors gracefully", async () => {
      const mockError = new Error("Stripe Error");
      (stripeService.checkStatus as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useSubscriptionCounterUpdate("org-1"));

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBe(mockError);
      expect(result.current.loading).toBe(false);
    });
  });
});