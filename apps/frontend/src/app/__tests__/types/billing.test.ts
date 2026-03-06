import type {
  BillingCounter,
  BillingSubscriptionPlan,
  BillingSubscriptionInterval,
  BillingSubscriptionStatus,
  BillingSubscriptionLastPaymentStatus,
  BillingSubscriptionAccessState,
  BillingSubscription,
  FreeMetric,
  CanResult,
} from "@/app/features/billing/types/billing";

describe("billing types", () => {
  describe("BillingCounter", () => {
    it("allows valid BillingCounter object", () => {
      const counter: BillingCounter = {
        orgId: "org-123",
        appointmentsUsed: 10,
        toolsUsed: 5,
        usersActiveCount: 3,
        usersBillableCount: 2,
        freeAppointmentsLimit: 100,
        freeToolsLimit: 50,
        freeUsersLimit: 5,
        freeLimitReachedAt: new Date(),
      };
      expect(counter.orgId).toBe("org-123");
      expect(counter.appointmentsUsed).toBe(10);
    });

    it("allows minimal BillingCounter with only orgId", () => {
      const counter: BillingCounter = {
        orgId: "org-456",
      };
      expect(counter.orgId).toBe("org-456");
      expect(counter.appointmentsUsed).toBeUndefined();
    });

    it("allows null for freeLimitReachedAt", () => {
      const counter: BillingCounter = {
        orgId: "org-789",
        freeLimitReachedAt: null,
      };
      expect(counter.freeLimitReachedAt).toBeNull();
    });
  });

  describe("BillingSubscriptionPlan", () => {
    it("allows free plan", () => {
      const plan: BillingSubscriptionPlan = "free";
      expect(plan).toBe("free");
    });

    it("allows business plan", () => {
      const plan: BillingSubscriptionPlan = "business";
      expect(plan).toBe("business");
    });
  });

  describe("BillingSubscriptionInterval", () => {
    it("allows month interval", () => {
      const interval: BillingSubscriptionInterval = "month";
      expect(interval).toBe("month");
    });

    it("allows year interval", () => {
      const interval: BillingSubscriptionInterval = "year";
      expect(interval).toBe("year");
    });
  });

  describe("BillingSubscriptionStatus", () => {
    const validStatuses: BillingSubscriptionStatus[] = [
      "none",
      "trialing",
      "active",
      "past_due",
      "unpaid",
      "canceled",
      "incomplete",
      "incomplete_expired",
      "paused",
    ];

    validStatuses.forEach((status) => {
      it(`allows ${status} status`, () => {
        const s: BillingSubscriptionStatus = status;
        expect(s).toBe(status);
      });
    });
  });

  describe("BillingSubscriptionLastPaymentStatus", () => {
    it("allows paid status", () => {
      const status: BillingSubscriptionLastPaymentStatus = "paid";
      expect(status).toBe("paid");
    });

    it("allows failed status", () => {
      const status: BillingSubscriptionLastPaymentStatus = "failed";
      expect(status).toBe("failed");
    });

    it("allows open status", () => {
      const status: BillingSubscriptionLastPaymentStatus = "open";
      expect(status).toBe("open");
    });
  });

  describe("BillingSubscriptionAccessState", () => {
    it("allows free state", () => {
      const state: BillingSubscriptionAccessState = "free";
      expect(state).toBe("free");
    });

    it("allows active state", () => {
      const state: BillingSubscriptionAccessState = "active";
      expect(state).toBe("active");
    });

    it("allows past_due state", () => {
      const state: BillingSubscriptionAccessState = "past_due";
      expect(state).toBe("past_due");
    });

    it("allows suspended state", () => {
      const state: BillingSubscriptionAccessState = "suspended";
      expect(state).toBe("suspended");
    });
  });

  describe("BillingSubscription", () => {
    it("allows full BillingSubscription object", () => {
      const subscription: BillingSubscription = {
        orgId: "org-123",
        connectAccountId: "acct_123",
        canAcceptPayments: true,
        connectChargesEnabled: true,
        connectPayoutsEnabled: true,
        connectDisabledReason: null,
        connectRequirements: {
          currentlyDue: [],
          eventuallyDue: [],
          pastDue: [],
          pendingVerification: [],
          errors: [],
        },
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        stripeSubscriptionItemId: "si_123",
        stripePriceId: "price_123",
        stripeProductId: "prod_123",
        stripeLivemode: true,
        plan: "business",
        billingInterval: "month",
        currency: "USD",
        seatQuantity: 5,
        seatQuantityUpdatedAt: new Date(),
        subscriptionStatus: "active",
        cancelAtPeriodEnd: false,
        canceledAt: null,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        nextInvoiceAt: new Date(),
        lastInvoiceId: "inv_123",
        lastPaymentStatus: "paid",
        lastPaymentAt: new Date(),
        joinedAt: new Date(),
        upgradedAt: new Date(),
        downgradedAt: null,
        accessState: "active",
        gracePeriodEndsAt: null,
        version: 1,
        lastStripeEventId: "evt_123",
      };
      expect(subscription.orgId).toBe("org-123");
      expect(subscription.plan).toBe("business");
    });

    it("allows minimal BillingSubscription with only orgId", () => {
      const subscription: BillingSubscription = {
        orgId: "org-456",
      };
      expect(subscription.orgId).toBe("org-456");
    });

    it("allows connectRequirements with partial fields", () => {
      const subscription: BillingSubscription = {
        orgId: "org-789",
        connectRequirements: {
          currentlyDue: ["document.required"],
        },
      };
      expect(subscription.connectRequirements?.currentlyDue).toContain(
        "document.required"
      );
    });
  });

  describe("FreeMetric", () => {
    it("allows appointments metric", () => {
      const metric: FreeMetric = "appointments";
      expect(metric).toBe("appointments");
    });

    it("allows users metric", () => {
      const metric: FreeMetric = "users";
      expect(metric).toBe("users");
    });
  });

  describe("CanResult", () => {
    it("allows CanResult with ok reason", () => {
      const result: CanResult = {
        canMore: true,
        remainingFree: 50,
        freeLimit: 100,
        used: 50,
        reason: "ok",
      };
      expect(result.canMore).toBe(true);
      expect(result.reason).toBe("ok");
    });

    it("allows CanResult with limit_reached reason", () => {
      const result: CanResult = {
        canMore: false,
        remainingFree: 0,
        freeLimit: 100,
        used: 100,
        reason: "limit_reached",
      };
      expect(result.canMore).toBe(false);
      expect(result.reason).toBe("limit_reached");
    });

    it("allows CanResult with null values", () => {
      const result: CanResult = {
        canMore: false,
        remainingFree: null,
        freeLimit: null,
        used: null,
        reason: "no_subscription",
      };
      expect(result.remainingFree).toBeNull();
      expect(result.freeLimit).toBeNull();
    });

    const validReasons: CanResult["reason"][] = [
      "no_subscription",
      "no_counter",
      "not_free_plan",
      "unknown_limit",
      "unknown_usage",
      "limit_reached",
      "ok",
    ];

    validReasons.forEach((reason) => {
      it(`allows ${reason} reason`, () => {
        const result: CanResult = {
          canMore: reason === "ok",
          remainingFree: 0,
          freeLimit: 0,
          used: 0,
          reason,
        };
        expect(result.reason).toBe(reason);
      });
    });
  });
});
