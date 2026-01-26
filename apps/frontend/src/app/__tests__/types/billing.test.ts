import {
  BillingCounter,
  BillingSubscription,
  BillingSubscriptionAccessState,
  BillingSubscriptionInterval,
  BillingSubscriptionPlan,
  BillingSubscriptionStatus,
} from "../../types/billing";

describe("billing types", () => {
  it("accepts billing counter shape", () => {
    const counter: BillingCounter = {
      orgId: "org-1",
      appointmentsUsed: 2,
      toolsUsed: 1,
      usersActiveCount: 3,
      usersBillableCount: 2,
    };

    expect(counter.orgId).toBe("org-1");
    expect(counter.toolsUsed).toBe(1);
  });

  it("accepts subscription union literals", () => {
    const plan: BillingSubscriptionPlan = "business";
    const interval: BillingSubscriptionInterval = "month";
    const status: BillingSubscriptionStatus = "active";
    const access: BillingSubscriptionAccessState = "active";

    expect(plan).toBe("business");
    expect(interval).toBe("month");
    expect(status).toBe("active");
    expect(access).toBe("active");
  });

  it("creates a billing subscription with optional fields", () => {
    const sub: BillingSubscription = {
      orgId: "org-1",
      plan: "free",
      subscriptionStatus: "none",
      accessState: "free",
      seatQuantity: 0,
    };

    expect(sub.orgId).toBe("org-1");
    expect(sub.plan).toBe("free");
  });
});
