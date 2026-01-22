import { useSubscriptionStore } from "../../stores/subscriptionStore";

const baseSubscription = {
  orgId: "org-1",
  plan: "free" as const,
  subscriptionStatus: "none" as const,
  accessState: "free" as const,
  seatQuantity: 0,
  currency: "USD",
};

describe("subscription store", () => {
  beforeEach(() => {
    useSubscriptionStore.setState({
      subscriptionByOrgId: {},
      status: "idle",
      error: null,
      lastFetchedAt: null,
    });
  });

  it("sets subscriptions and indexes by orgId", () => {
    useSubscriptionStore.getState().setSubscriptions([baseSubscription]);

    const state = useSubscriptionStore.getState();
    expect(state.subscriptionByOrgId["org-1"]).toEqual(baseSubscription);
    expect(state.status).toBe("loaded");
  });

  it("upgrades to business", () => {
    useSubscriptionStore.getState().setSubscriptions([baseSubscription]);

    useSubscriptionStore
      .getState()
      .upgradeToBusiness("org-1", "month", { seatQuantity: 3 });

    const sub = useSubscriptionStore.getState().subscriptionByOrgId["org-1"];
    expect(sub.plan).toBe("business");
    expect(sub.billingInterval).toBe("month");
    expect(sub.seatQuantity).toBe(3);
  });

  it("downgrades to free and clears seats by default", () => {
    useSubscriptionStore.getState().setSubscriptions([
      { ...baseSubscription, plan: "business", seatQuantity: 5 },
    ]);

    useSubscriptionStore.getState().downgradeToFree("org-1");

    const sub = useSubscriptionStore.getState().subscriptionByOrgId["org-1"];
    expect(sub.plan).toBe("free");
    expect(sub.seatQuantity).toBe(0);
    expect(sub.accessState).toBe("free");
  });

  it("keeps seat quantity when requested", () => {
    useSubscriptionStore.getState().setSubscriptions([
      { ...baseSubscription, plan: "business", seatQuantity: 5 },
    ]);

    useSubscriptionStore
      .getState()
      .downgradeToFree("org-1", { keepSeatQuantity: true });

    const sub = useSubscriptionStore.getState().subscriptionByOrgId["org-1"];
    expect(sub.seatQuantity).toBe(5);
  });
});
