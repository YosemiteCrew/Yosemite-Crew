import { act } from "@testing-library/react";
import { useSubscriptionStore } from "@/app/stores/subscriptionStore";
import {
  BillingSubscription,
  BillingSubscriptionStatus,
} from "@/app/features/billing/types/billing";

// ----------------------------------------------------------------------------
// 1. Setup & Helpers
// ----------------------------------------------------------------------------

// Helper function to create a mock subscription object
const mockSub = (orgId: string, overrides = {}): BillingSubscription => ({
  orgId,
  plan: "free",
  seatQuantity: 5,
  currency: "usd",
  accessState: "active",
  subscriptionStatus: "active",
  ...overrides,
} as BillingSubscription);

describe("Subscription Store", () => {
  beforeEach(() => {
    // Reset store state before each test to ensure isolation
    act(() => {
      useSubscriptionStore.getState().clearSubscriptions();
    });
  });

  // --------------------------------------------------------------------------
  // 2. Core Actions (Set/Get/Upsert)
  // --------------------------------------------------------------------------

  describe("Core Actions", () => {
    it("initializes with default state", () => {
      const state = useSubscriptionStore.getState();
      expect(state.subscriptionByOrgId).toEqual({});
      expect(state.status).toBe("idle");
      expect(state.error).toBeNull();
    });

    it("sets multiple subscriptions correctly", () => {
      const subs = [mockSub("org-1"), mockSub("org-2")];

      act(() => {
        useSubscriptionStore.getState().setSubscriptions(subs);
      });

      const state = useSubscriptionStore.getState();
      expect(state.status).toBe("loaded");
      expect(state.subscriptionByOrgId["org-1"]).toEqual(subs[0]);
      expect(state.subscriptionByOrgId["org-2"]).toEqual(subs[1]);
    });

    it("skips subscriptions without orgId in setSubscriptions", () => {
      const invalidSub = { ...mockSub("org-1"), orgId: "" };

      act(() => {
        useSubscriptionStore.getState().setSubscriptions([invalidSub]);
      });

      const state = useSubscriptionStore.getState();
      expect(Object.keys(state.subscriptionByOrgId)).toHaveLength(0);
    });

    it("sets a single subscription for an org", () => {
      const sub = mockSub("org-1");

      act(() => {
        useSubscriptionStore.getState().setSubscriptionForOrg("org-1", sub);
      });

      const fetched = useSubscriptionStore.getState().getSubscriptionByOrgId("org-1");
      expect(fetched).toEqual(sub);
    });

    it("removes subscription if setSubscriptionForOrg is called with null", () => {
      const sub = mockSub("org-1");

      act(() => {
        useSubscriptionStore.getState().setSubscriptionForOrg("org-1", sub);
        useSubscriptionStore.getState().setSubscriptionForOrg("org-1", null);
      });

      const fetched = useSubscriptionStore.getState().getSubscriptionByOrgId("org-1");
      expect(fetched).toBeNull();
    });

    it("ignores setSubscriptionForOrg if orgId is missing", () => {
        act(() => {
            useSubscriptionStore.getState().setSubscriptionForOrg("", mockSub("org-1"));
        });
        const state = useSubscriptionStore.getState();
        expect(Object.keys(state.subscriptionByOrgId)).toHaveLength(0);
    });

    it("upserts (merges) a subscription", () => {
      const initial = mockSub("org-1", { seatQuantity: 10 });
      const update = { orgId: "org-1", seatQuantity: 20 } as BillingSubscription;

      act(() => {
        useSubscriptionStore.getState().upsertSubscription(initial);
        useSubscriptionStore.getState().upsertSubscription(update);
      });

      const result = useSubscriptionStore.getState().getSubscriptionByOrgId("org-1");
      expect(result?.seatQuantity).toBe(20);
      expect(result?.plan).toBe("free"); // Retains merged fields
    });

    it("warns and skips upsert if orgId is missing in payload", () => {
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();

      act(() => {
        useSubscriptionStore.getState().upsertSubscription({} as any);
      });

      const state = useSubscriptionStore.getState();
      expect(Object.keys(state.subscriptionByOrgId)).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "upsertSubscription: invalid subscription",
        expect.anything()
      );

      consoleWarnSpy.mockRestore();
    });

    it("removes a subscription explicitly", () => {
      act(() => {
        useSubscriptionStore.getState().setSubscriptionForOrg("org-1", mockSub("org-1"));
        useSubscriptionStore.getState().removeSubscriptionForOrg("org-1");
      });

      const result = useSubscriptionStore.getState().getSubscriptionByOrgId("org-1");
      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 3. Status & Loading Actions
  // --------------------------------------------------------------------------

  describe("Status Actions", () => {
    it("handles loading states", () => {
      act(() => useSubscriptionStore.getState().startLoading());
      expect(useSubscriptionStore.getState().status).toBe("loading");

      act(() => useSubscriptionStore.getState().endLoading());
      expect(useSubscriptionStore.getState().status).toBe("loaded");
    });

    it("sets error message", () => {
      act(() => useSubscriptionStore.getState().setError("Failed to load"));
      const state = useSubscriptionStore.getState();
      expect(state.status).toBe("error");
      expect(state.error).toBe("Failed to load");
    });

    it("clears subscriptions and resets status", () => {
      act(() => {
        useSubscriptionStore.getState().setSubscriptionForOrg("org-1", mockSub("org-1"));
        useSubscriptionStore.getState().clearSubscriptions();
      });

      const state = useSubscriptionStore.getState();
      expect(state.subscriptionByOrgId).toEqual({});
      expect(state.status).toBe("idle");
      expect(state.lastFetchedAt).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 4. Complex Logic (Patch / Upgrade / Downgrade)
  // --------------------------------------------------------------------------

  describe("Business Logic Actions", () => {
    it("patches an existing subscription", () => {
      act(() => {
        useSubscriptionStore.getState().setSubscriptionForOrg("org-1", mockSub("org-1"));
        useSubscriptionStore.getState().patchSubscription("org-1", { seatQuantity: 99 });
      });

      const sub = useSubscriptionStore.getState().getSubscriptionByOrgId("org-1");
      expect(sub?.seatQuantity).toBe(99);
    });

    it("ignores patch if subscription does not exist", () => {
      act(() => {
        useSubscriptionStore.getState().patchSubscription("org-missing", { seatQuantity: 99 });
      });
      // Should not crash or add anything
      const sub = useSubscriptionStore.getState().getSubscriptionByOrgId("org-missing");
      expect(sub).toBeNull();
    });

    it("upgrades to business plan correctly", () => {
      const initial = mockSub("org-1", { plan: "free", seatQuantity: 5 });
      act(() => {
        useSubscriptionStore.getState().setSubscriptionForOrg("org-1", initial);
        useSubscriptionStore.getState().upgradeToBusiness("org-1", "year", {
          seatQuantity: 10,
          currency: "eur",
        });
      });

      const updated = useSubscriptionStore.getState().getSubscriptionByOrgId("org-1");
      expect(updated?.plan).toBe("business");
      expect(updated?.billingInterval).toBe("year");
      expect(updated?.seatQuantity).toBe(10);
      expect(updated?.currency).toBe("eur");
      expect(updated?.upgradedAt).toBeDefined();
    });

    it("upgrades to business plan using defaults if opts missing", () => {
        const initial = mockSub("org-1", { plan: "free", seatQuantity: 5, currency: "usd" });
        act(() => {
          useSubscriptionStore.getState().setSubscriptionForOrg("org-1", initial);
          useSubscriptionStore.getState().upgradeToBusiness("org-1", "month");
        });

        const updated = useSubscriptionStore.getState().getSubscriptionByOrgId("org-1");
        expect(updated?.currency).toBe("usd"); // Kept previous
        expect(updated?.seatQuantity).toBe(5); // Kept previous
        expect(updated?.accessState).toBe("active"); // Default
      });

    it("ignores upgrade if subscription missing", () => {
        act(() => {
            useSubscriptionStore.getState().upgradeToBusiness("org-missing", "year");
        });
        const sub = useSubscriptionStore.getState().getSubscriptionByOrgId("org-missing");
        expect(sub).toBeNull();
    });

    it("downgrades to free plan correctly", () => {
      const initial = mockSub("org-1", { plan: "business", seatQuantity: 50 });
      act(() => {
        useSubscriptionStore.getState().setSubscriptionForOrg("org-1", initial);
        useSubscriptionStore.getState().downgradeToFree("org-1", {
          keepSeatQuantity: true,
          subscriptionStatus: "canceled" as BillingSubscriptionStatus,
        });
      });

      const updated = useSubscriptionStore.getState().getSubscriptionByOrgId("org-1");
      expect(updated?.plan).toBe("free");
      expect(updated?.billingInterval).toBeUndefined();
      expect(updated?.subscriptionStatus).toBe("canceled");
      expect(updated?.seatQuantity).toBe(50); // Kept
      expect(updated?.downgradedAt).toBeDefined();
    });

    it("downgrades to free plan resetting seats if keepSeatQuantity is false", () => {
        const initial = mockSub("org-1", { plan: "business", seatQuantity: 50 });
        act(() => {
          useSubscriptionStore.getState().setSubscriptionForOrg("org-1", initial);
          useSubscriptionStore.getState().downgradeToFree("org-1");
        });

        const updated = useSubscriptionStore.getState().getSubscriptionByOrgId("org-1");
        expect(updated?.seatQuantity).toBe(0); // Reset
        expect(updated?.subscriptionStatus).toBe("none"); // Default
        expect(updated?.accessState).toBe("free"); // Default
      });

    it("ignores downgrade if subscription missing", () => {
        act(() => {
            useSubscriptionStore.getState().downgradeToFree("org-missing");
        });
        const sub = useSubscriptionStore.getState().getSubscriptionByOrgId("org-missing");
        expect(sub).toBeNull();
    });
  });
});