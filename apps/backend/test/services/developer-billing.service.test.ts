import {
  DeveloperBillingService,
  DeveloperBillingServiceError,
} from "../../src/services/developer-billing.service";
import { prisma } from "../../src/config/prisma";
import logger from "../../src/utils/logger";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    developerSubscription: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.mock("stripe", () => {
  const mockCustomersCreate = jest.fn();
  const mockCheckoutSessionsCreate = jest.fn();
  const mockBillingPortalCreate = jest.fn();
  const mockSubscriptionsRetrieve = jest.fn();
  const mockSubscriptionsCancel = jest.fn();
  const mockCheckoutSessionsList = jest.fn();
  const mockCheckoutSessionsExpire = jest.fn();
  const mockWebhooksConstructEvent = jest.fn();
  const mockMeterEventsCreate = jest.fn();

  const MockStripe = jest.fn().mockImplementation(() => ({
    customers: { create: mockCustomersCreate },
    checkout: {
      sessions: {
        create: mockCheckoutSessionsCreate,
        list: mockCheckoutSessionsList,
        expire: mockCheckoutSessionsExpire,
      },
    },
    billingPortal: { sessions: { create: mockBillingPortalCreate } },
    subscriptions: {
      retrieve: mockSubscriptionsRetrieve,
      cancel: mockSubscriptionsCancel,
    },
    billing: { meterEvents: { create: mockMeterEventsCreate } },
    webhooks: { constructEvent: mockWebhooksConstructEvent },
  }));

  return { __esModule: true, default: MockStripe };
});

const mockPrisma = prisma as unknown as {
  developerSubscription: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    upsert: jest.Mock;
    update: jest.Mock;
    deleteMany: jest.Mock;
  };
  user: {
    findFirst: jest.Mock;
  };
};

const getStripeInstance = () => {
  const Stripe = jest.requireMock("stripe").default;
  return new Stripe();
};

describe("DeveloperBillingService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getStripeInstance().checkout.sessions.list.mockResolvedValue({ data: [] });
    // A completed checkout is refused for a deleted account; default to live.
    mockPrisma.user.findFirst.mockResolvedValue({ isActive: true });
    process.env.STRIPE_SECRET_KEY = "sk_test_key";
    process.env.STRIPE_DEV_METERED_PRICE_ID = "price_metered_abc";
    process.env.STRIPE_DEV_WEBHOOK_SECRET = "whsec_test";
  });

  describe("toSubscriptionStatus, via the subscription.updated webhook", () => {
    // Local fixture: the one in the webhook describe below is out of scope here.
    const subscriptionFixture = {
      id: "sub_status",
      status: "active",
      customer: "cus_x",
      cancel_at_period_end: false,
      items: {
        data: [
          {
            id: "si_x",
            price: { id: "price_metered_abc" },
            current_period_start: 1750000000,
            current_period_end: 1752678400,
          },
        ],
      },
    };

    const updateWith = async (stripeStatus: string) => {
      mockPrisma.developerSubscription.findFirst.mockResolvedValue({
        id: "ds-1",
        stripePriceId: "price_metered_abc",
        stripeSubscriptionItemId: "si_x",
      });
      mockPrisma.developerSubscription.update.mockResolvedValue({});

      await DeveloperBillingService.handleWebhookEvent({
        id: "evt_status",
        type: "customer.subscription.updated",
        data: { object: { ...subscriptionFixture, status: stripeStatus } },
      } as never);

      return mockPrisma.developerSubscription.update.mock.calls.at(-1)?.[0]
        ?.data?.status;
    };

    it.each([
      ["active", "active"],
      ["trialing", "trialing"],
      ["past_due", "past_due"],
      ["canceled", "canceled"],
      ["incomplete", "incomplete"],
    ])("passes %s through as %s", async (stripe, expected) => {
      expect(await updateWith(stripe)).toBe(expected);
    });

    it.each([
      ["unpaid", "past_due"],
      ["paused", "past_due"],
      ["incomplete_expired", "canceled"],
    ])(
      "maps %s to %s rather than active, because collection has stopped",
      async (stripe, expected) => {
        expect(await updateWith(stripe)).toBe(expected);
      },
    );

    it("records an unrecognised status as incomplete and says so", async () => {
      // Reporting a subscription as healthier than Stripe believes it to be is
      // the failure worth avoiding, so an unknown status must not become active.
      expect(await updateWith("some_future_status")).toBe("incomplete");
      expect(jest.mocked(logger.error)).toHaveBeenCalledWith(
        expect.stringContaining("some_future_status"),
      );
    });
  });

  describe("cancelForOwner", () => {
    it("cancels the live Stripe subscription and removes the row", async () => {
      mockPrisma.developerSubscription.findUnique.mockResolvedValue({
        stripeSubscriptionId: "sub_live_1",
      });

      await DeveloperBillingService.cancelForOwner("user-1");

      expect(getStripeInstance().subscriptions.cancel).toHaveBeenCalledWith(
        "sub_live_1",
      );
      expect(mockPrisma.developerSubscription.deleteMany).toHaveBeenCalledWith({
        where: { ownerUserId: "user-1" },
      });
    });

    it("expires open checkout sessions so a later completion cannot resurrect billing", async () => {
      // Between getOrCreateCustomer and completion the row holds a customer and
      // a null subscription id, so cancelling the subscription is a no-op while
      // the hosted Checkout page stays live.
      mockPrisma.developerSubscription.findUnique.mockResolvedValue({
        stripeSubscriptionId: null,
        stripeCustomerId: "cus_1",
      });
      const stripe = getStripeInstance();
      stripe.checkout.sessions.list.mockResolvedValue({
        data: [{ id: "cs_1" }, { id: "cs_2" }],
      });

      await DeveloperBillingService.cancelForOwner("user-1");

      expect(stripe.checkout.sessions.list).toHaveBeenCalledWith({
        customer: "cus_1",
        status: "open",
        limit: 100,
      });
      expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith("cs_1");
      expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith("cs_2");
      expect(mockPrisma.developerSubscription.deleteMany).toHaveBeenCalled();
    });

    it("still deletes the row when expiring sessions fails", async () => {
      mockPrisma.developerSubscription.findUnique.mockResolvedValue({
        stripeSubscriptionId: null,
        stripeCustomerId: "cus_1",
      });
      getStripeInstance().checkout.sessions.list.mockRejectedValueOnce(
        new Error("stripe down"),
      );

      await expect(
        DeveloperBillingService.cancelForOwner("user-1"),
      ).resolves.toBeUndefined();
      expect(mockPrisma.developerSubscription.deleteMany).toHaveBeenCalled();
    });

    it("removes a row that never reached Stripe without calling Stripe", async () => {
      mockPrisma.developerSubscription.findUnique.mockResolvedValue({
        stripeSubscriptionId: null,
      });

      await DeveloperBillingService.cancelForOwner("user-1");

      expect(getStripeInstance().subscriptions.cancel).not.toHaveBeenCalled();
      expect(mockPrisma.developerSubscription.deleteMany).toHaveBeenCalled();
    });

    it("still deletes the row when Stripe rejects the cancellation", async () => {
      // Deletion is already in flight; a Stripe outage must not leave the
      // account half-removed. The error is logged for manual cleanup.
      mockPrisma.developerSubscription.findUnique.mockResolvedValue({
        stripeSubscriptionId: "sub_live_1",
      });
      getStripeInstance().subscriptions.cancel.mockRejectedValueOnce(
        new Error("stripe down"),
      );

      await expect(
        DeveloperBillingService.cancelForOwner("user-1"),
      ).resolves.toBeUndefined();
      expect(mockPrisma.developerSubscription.deleteMany).toHaveBeenCalled();
    });

    it("does nothing when the owner has no subscription", async () => {
      mockPrisma.developerSubscription.findUnique.mockResolvedValue(null);

      await DeveloperBillingService.cancelForOwner("user-1");

      expect(
        mockPrisma.developerSubscription.deleteMany,
      ).not.toHaveBeenCalled();
    });

    it("ignores a blank owner id", async () => {
      await DeveloperBillingService.cancelForOwner("   ");

      expect(
        mockPrisma.developerSubscription.findUnique,
      ).not.toHaveBeenCalled();
    });
  });

  describe("getSubscription", () => {
    it("returns the record when found", async () => {
      const record = {
        id: "sub-1",
        ownerUserId: "org-1",
        plan: "pro",
        status: "active",
        stripeSubscriptionItemId: "si_x",
        currentPeriodStart: new Date("2026-06-01"),
        currentPeriodEnd: new Date("2026-07-01"),
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.developerSubscription.findUnique.mockResolvedValue(record);
      const result = await DeveloperBillingService.getSubscription("org-1");
      expect(result).toEqual(record);
    });

    it("returns a free default when no record exists", async () => {
      mockPrisma.developerSubscription.findUnique.mockResolvedValue(null);
      const result = await DeveloperBillingService.getSubscription("org-1");
      expect(result.plan).toBe("free");
      expect(result.id).toBeNull();
    });

    it("throws 400 on empty ownerUserId", async () => {
      await expect(
        DeveloperBillingService.getSubscription(""),
      ).rejects.toBeInstanceOf(DeveloperBillingServiceError);
    });
  });

  describe("getOrCreateCustomer", () => {
    it("returns existing stripeCustomerId without calling Stripe", async () => {
      mockPrisma.developerSubscription.findUnique.mockResolvedValue({
        stripeCustomerId: "cus_existing",
      });
      const id = await DeveloperBillingService.getOrCreateCustomer("org-1");
      expect(id).toBe("cus_existing");
      const stripe = getStripeInstance();
      expect(stripe.customers.create).not.toHaveBeenCalled();
    });

    it("creates a Stripe customer and upserts the record", async () => {
      mockPrisma.developerSubscription.findUnique.mockResolvedValue(null);
      const stripe = getStripeInstance();
      stripe.customers.create.mockResolvedValue({ id: "cus_new" });
      mockPrisma.developerSubscription.upsert.mockResolvedValue({});

      const id = await DeveloperBillingService.getOrCreateCustomer("org-1");
      expect(id).toBe("cus_new");
      expect(mockPrisma.developerSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ownerUserId: "org-1" },
          create: expect.objectContaining({ stripeCustomerId: "cus_new" }),
        }),
      );
    });
  });

  describe("createCheckoutSession", () => {
    it("returns the checkout URL using the metered price", async () => {
      mockPrisma.developerSubscription.findUnique.mockResolvedValue({
        stripeCustomerId: "cus_x",
      });
      const stripe = getStripeInstance();
      stripe.checkout.sessions.create.mockResolvedValue({
        url: "https://checkout.stripe.com/test",
      });

      const url = await DeveloperBillingService.createCheckoutSession({
        ownerUserId: "org-1",
        successUrl: "https://app.com/success",
        cancelUrl: "https://app.com/cancel",
      });

      expect(url).toBe("https://checkout.stripe.com/test");
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "subscription",
          customer: "cus_x",
          line_items: [{ price: "price_metered_abc" }],
        }),
      );
    });

    it("throws 400 on empty ownerUserId", async () => {
      await expect(
        DeveloperBillingService.createCheckoutSession({
          ownerUserId: "",
          successUrl: "https://app.com/success",
          cancelUrl: "https://app.com/cancel",
        }),
      ).rejects.toBeInstanceOf(DeveloperBillingServiceError);
    });

    it("throws 500 when session url is missing", async () => {
      mockPrisma.developerSubscription.findUnique.mockResolvedValue({
        stripeCustomerId: "cus_x",
      });
      const stripe = getStripeInstance();
      stripe.checkout.sessions.create.mockResolvedValue({ url: null });

      await expect(
        DeveloperBillingService.createCheckoutSession({
          ownerUserId: "org-1",
          successUrl: "https://app.com/success",
          cancelUrl: "https://app.com/cancel",
        }),
      ).rejects.toMatchObject({ statusCode: 500 });
    });

    it("throws 500 when STRIPE_DEV_METERED_PRICE_ID is not set", async () => {
      delete process.env.STRIPE_DEV_METERED_PRICE_ID;
      mockPrisma.developerSubscription.findUnique.mockResolvedValue({
        stripeCustomerId: "cus_x",
      });

      await expect(
        DeveloperBillingService.createCheckoutSession({
          ownerUserId: "org-1",
          successUrl: "https://app.com/success",
          cancelUrl: "https://app.com/cancel",
        }),
      ).rejects.toMatchObject({ statusCode: 500 });
    });
  });

  describe("createPortalSession", () => {
    it("returns the portal URL", async () => {
      mockPrisma.developerSubscription.findUnique.mockResolvedValue({
        stripeCustomerId: "cus_x",
      });
      const stripe = getStripeInstance();
      stripe.billingPortal.sessions.create.mockResolvedValue({
        url: "https://billing.stripe.com/session",
      });

      const url = await DeveloperBillingService.createPortalSession({
        ownerUserId: "org-1",
        returnUrl: "https://app.com/billing",
      });

      expect(url).toBe("https://billing.stripe.com/session");
    });

    it("throws 404 when no Stripe customer exists", async () => {
      mockPrisma.developerSubscription.findUnique.mockResolvedValue(null);

      await expect(
        DeveloperBillingService.createPortalSession({
          ownerUserId: "org-1",
          returnUrl: "https://app.com/billing",
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("throws 400 on empty ownerUserId", async () => {
      await expect(
        DeveloperBillingService.createPortalSession({
          ownerUserId: "",
          returnUrl: "https://app.com/billing",
        }),
      ).rejects.toBeInstanceOf(DeveloperBillingServiceError);
    });
  });

  describe("reportUsage", () => {
    it("calls stripe.billing.meterEvents.create with customer and quantity", async () => {
      process.env.STRIPE_DEV_METER_EVENT_NAME = "api_calls";
      const stripe = getStripeInstance();
      stripe.billing.meterEvents.create.mockResolvedValue({});

      await DeveloperBillingService.reportUsage("cus_abc", 42);

      expect(stripe.billing.meterEvents.create).toHaveBeenCalledWith({
        event_name: "api_calls",
        payload: { stripe_customer_id: "cus_abc", value: "42" },
      });
    });

    it("passes the identifier through so Stripe can drop a duplicate post", async () => {
      process.env.STRIPE_DEV_METER_EVENT_NAME = "api_calls";
      const stripe = getStripeInstance();
      stripe.billing.meterEvents.create.mockResolvedValue({});

      await DeveloperBillingService.reportUsage(
        "cus_abc",
        1,
        "dev-api-org-1-2026-06-7",
      );

      expect(stripe.billing.meterEvents.create).toHaveBeenCalledWith({
        event_name: "api_calls",
        payload: { stripe_customer_id: "cus_abc", value: "1" },
        identifier: "dev-api-org-1-2026-06-7",
      });
    });

    it("omits identifier entirely when none is given, rather than sending undefined", async () => {
      process.env.STRIPE_DEV_METER_EVENT_NAME = "api_calls";
      const stripe = getStripeInstance();
      stripe.billing.meterEvents.create.mockResolvedValue({});

      await DeveloperBillingService.reportUsage("cus_abc", 1);

      const [params] = stripe.billing.meterEvents.create.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(Object.hasOwn(params, "identifier")).toBe(false);
    });

    it("does nothing when quantity is zero", async () => {
      process.env.STRIPE_DEV_METER_EVENT_NAME = "api_calls";
      const stripe = getStripeInstance();
      await DeveloperBillingService.reportUsage("cus_abc", 0);
      expect(stripe.billing.meterEvents.create).not.toHaveBeenCalled();
    });

    it("does nothing when customerId is empty", async () => {
      process.env.STRIPE_DEV_METER_EVENT_NAME = "api_calls";
      const stripe = getStripeInstance();
      await DeveloperBillingService.reportUsage("", 10);
      expect(stripe.billing.meterEvents.create).not.toHaveBeenCalled();
    });

    it("does nothing when STRIPE_DEV_METER_EVENT_NAME is not set", async () => {
      delete process.env.STRIPE_DEV_METER_EVENT_NAME;
      const stripe = getStripeInstance();
      await DeveloperBillingService.reportUsage("cus_abc", 10);
      expect(stripe.billing.meterEvents.create).not.toHaveBeenCalled();
    });
  });

  describe("handleWebhookEvent", () => {
    const baseSubscription = {
      id: "sub_123",
      status: "active",
      customer: "cus_x",
      cancel_at_period_end: false,
      items: {
        data: [
          {
            id: "si_x",
            price: { id: "price_metered_abc" },
            current_period_start: 1750000000,
            current_period_end: 1752678400,
          },
        ],
      },
    };

    it("upserts a DeveloperSubscription on checkout.session.completed", async () => {
      const stripe = getStripeInstance();
      stripe.subscriptions.retrieve.mockResolvedValue(baseSubscription);
      mockPrisma.developerSubscription.upsert.mockResolvedValue({});

      await DeveloperBillingService.handleWebhookEvent({
        id: "evt_1",
        type: "checkout.session.completed",
        data: {
          object: {
            mode: "subscription",
            subscription: "sub_123",
            metadata: { ownerUserId: "org-1" },
          },
        },
      } as never);

      expect(mockPrisma.developerSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ownerUserId: "org-1" },
          create: expect.objectContaining({
            plan: "pro",
            stripeSubscriptionId: "sub_123",
            stripeSubscriptionItemId: "si_x",
          }),
        }),
      );
    });

    it("skips checkout.session.completed when mode is not subscription", async () => {
      await DeveloperBillingService.handleWebhookEvent({
        id: "evt_2",
        type: "checkout.session.completed",
        data: { object: { mode: "payment", subscription: null, metadata: {} } },
      } as never);

      expect(mockPrisma.developerSubscription.upsert).not.toHaveBeenCalled();
    });

    it("refuses a completed checkout for an account that is no longer active", async () => {
      // Expiring sessions at deletion is best-effort; this is the backstop that
      // makes resurrection impossible rather than unlikely.
      mockPrisma.user.findFirst.mockResolvedValue({ isActive: false });

      await DeveloperBillingService.handleWebhookEvent({
        id: "evt_dead",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_dead",
            mode: "subscription",
            subscription: "sub_dead",
            metadata: { ownerUserId: "user-gone" },
          },
        },
      } as never);

      expect(mockPrisma.developerSubscription.upsert).not.toHaveBeenCalled();
      expect(jest.mocked(logger.error)).toHaveBeenCalledWith(
        expect.stringContaining("no longer active"),
        expect.objectContaining({ sessionId: "cs_dead" }),
      );
    });

    it("logs a checkout session that predates the re-key instead of ignoring it silently", async () => {
      // Such a session carries organisationId and no ownerUserId. Writing the
      // org id into an owner column would hide the row from the developer who
      // paid, so it is skipped - but a paying developer with no record must be
      // visible, not silent.
      await DeveloperBillingService.handleWebhookEvent({
        id: "evt_legacy",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_legacy",
            mode: "subscription",
            subscription: "sub_legacy",
            metadata: { organisationId: "org-1" },
          },
        },
      } as never);

      expect(mockPrisma.developerSubscription.upsert).not.toHaveBeenCalled();
      expect(jest.mocked(logger.error)).toHaveBeenCalledWith(
        expect.stringContaining("predates the developer re-key"),
        { eventId: "evt_legacy", sessionId: "cs_legacy" },
      );
    });

    it("skips a subscription checkout with no organisation metadata quietly", async () => {
      await DeveloperBillingService.handleWebhookEvent({
        id: "evt_blank",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_blank",
            mode: "subscription",
            subscription: "sub_blank",
            metadata: {},
          },
        },
      } as never);

      expect(mockPrisma.developerSubscription.upsert).not.toHaveBeenCalled();
      expect(jest.mocked(logger.error)).not.toHaveBeenCalled();
    });

    it("updates the record on customer.subscription.updated", async () => {
      mockPrisma.developerSubscription.findFirst.mockResolvedValue({
        id: "ds-1",
        stripePriceId: "price_metered_abc",
        stripeSubscriptionItemId: "si_x",
      });
      mockPrisma.developerSubscription.update.mockResolvedValue({});

      await DeveloperBillingService.handleWebhookEvent({
        id: "evt_3",
        type: "customer.subscription.updated",
        data: { object: { ...baseSubscription, status: "past_due" } },
      } as never);

      expect(mockPrisma.developerSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ds-1" },
          data: expect.objectContaining({ status: "past_due" }),
        }),
      );
    });

    it("skips customer.subscription.updated when record not found", async () => {
      mockPrisma.developerSubscription.findFirst.mockResolvedValue(null);
      await DeveloperBillingService.handleWebhookEvent({
        id: "evt_4",
        type: "customer.subscription.updated",
        data: { object: baseSubscription },
      } as never);
      expect(mockPrisma.developerSubscription.update).not.toHaveBeenCalled();
    });

    it("downgrades to free on customer.subscription.deleted", async () => {
      mockPrisma.developerSubscription.findFirst.mockResolvedValue({
        id: "ds-1",
        stripePriceId: "price_metered_abc",
        stripeSubscriptionItemId: "si_x",
      });
      mockPrisma.developerSubscription.update.mockResolvedValue({});

      await DeveloperBillingService.handleWebhookEvent({
        id: "evt_5",
        type: "customer.subscription.deleted",
        data: { object: { ...baseSubscription, status: "canceled" } },
      } as never);

      expect(mockPrisma.developerSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ plan: "free", status: "canceled" }),
        }),
      );
    });

    it("skips customer.subscription.deleted when record not found", async () => {
      mockPrisma.developerSubscription.findFirst.mockResolvedValue(null);
      await DeveloperBillingService.handleWebhookEvent({
        id: "evt_6",
        type: "customer.subscription.deleted",
        data: { object: { ...baseSubscription, status: "canceled" } },
      } as never);
      expect(mockPrisma.developerSubscription.update).not.toHaveBeenCalled();
    });

    it("logs and continues on unknown event type (default branch)", async () => {
      await DeveloperBillingService.handleWebhookEvent({
        id: "evt_7",
        type: "payment_intent.created",
        data: { object: {} },
      } as never);
      expect(mockPrisma.developerSubscription.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.developerSubscription.update).not.toHaveBeenCalled();
    });

    it("handles checkout.session.completed when subscription is an object", async () => {
      const stripe = getStripeInstance();
      stripe.subscriptions.retrieve.mockResolvedValue(baseSubscription);
      mockPrisma.developerSubscription.upsert.mockResolvedValue({});

      await DeveloperBillingService.handleWebhookEvent({
        id: "evt_8",
        type: "checkout.session.completed",
        data: {
          object: {
            mode: "subscription",
            subscription: { id: "sub_123" },
            metadata: { ownerUserId: "org-1" },
          },
        },
      } as never);

      expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith(
        "sub_123",
        expect.any(Object),
      );
    });

    it("handles checkout with customer as object (not string)", async () => {
      const stripe = getStripeInstance();
      const subWithObjCustomer = {
        ...baseSubscription,
        customer: { id: "cus_obj" },
      };
      stripe.subscriptions.retrieve.mockResolvedValue(subWithObjCustomer);
      mockPrisma.developerSubscription.upsert.mockResolvedValue({});

      await DeveloperBillingService.handleWebhookEvent({
        id: "evt_9",
        type: "checkout.session.completed",
        data: {
          object: {
            mode: "subscription",
            subscription: "sub_123",
            metadata: { ownerUserId: "org-1" },
          },
        },
      } as never);

      expect(mockPrisma.developerSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ stripeCustomerId: "cus_obj" }),
        }),
      );
    });

    it("skips checkout.session.completed when subscription id is missing", async () => {
      await DeveloperBillingService.handleWebhookEvent({
        id: "evt_10",
        type: "checkout.session.completed",
        data: {
          object: {
            mode: "subscription",
            subscription: null,
            metadata: { ownerUserId: "org-1" },
          },
        },
      } as never);
      expect(mockPrisma.developerSubscription.upsert).not.toHaveBeenCalled();
    });

    it("skips checkout.session.completed when ownerUserId metadata is missing", async () => {
      await DeveloperBillingService.handleWebhookEvent({
        id: "evt_11",
        type: "checkout.session.completed",
        data: {
          object: {
            mode: "subscription",
            subscription: "sub_123",
            metadata: {},
          },
        },
      } as never);
      expect(mockPrisma.developerSubscription.upsert).not.toHaveBeenCalled();
    });

    it("upserts with null periods when subscription has no items", async () => {
      const stripe = getStripeInstance();
      stripe.subscriptions.retrieve.mockResolvedValue({
        ...baseSubscription,
        items: { data: [] },
      });
      mockPrisma.developerSubscription.upsert.mockResolvedValue({});

      await DeveloperBillingService.handleWebhookEvent({
        id: "evt_12",
        type: "checkout.session.completed",
        data: {
          object: {
            mode: "subscription",
            subscription: "sub_123",
            metadata: { ownerUserId: "org-1" },
          },
        },
      } as never);

      expect(mockPrisma.developerSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            stripeSubscriptionItemId: null,
            stripePriceId: null,
            currentPeriodStart: null,
            currentPeriodEnd: null,
          }),
        }),
      );
    });

    it("handles subscription.updated with no items — falls back to record values", async () => {
      mockPrisma.developerSubscription.findFirst.mockResolvedValue({
        id: "ds-1",
        stripePriceId: "price_old",
        stripeSubscriptionItemId: "si_old",
      });
      mockPrisma.developerSubscription.update.mockResolvedValue({});

      await DeveloperBillingService.handleWebhookEvent({
        id: "evt_13",
        type: "customer.subscription.updated",
        data: {
          object: {
            ...baseSubscription,
            items: { data: [] },
            status: "trialing",
          },
        },
      } as never);

      expect(mockPrisma.developerSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "trialing",
            stripePriceId: "price_old",
            stripeSubscriptionItemId: "si_old",
            currentPeriodStart: null,
            currentPeriodEnd: null,
          }),
        }),
      );
    });

    it("maps incomplete status via toSubscriptionStatus", async () => {
      mockPrisma.developerSubscription.findFirst.mockResolvedValue({
        id: "ds-1",
        stripePriceId: "price_old",
        stripeSubscriptionItemId: "si_old",
      });
      mockPrisma.developerSubscription.update.mockResolvedValue({});

      await DeveloperBillingService.handleWebhookEvent({
        id: "evt_14",
        type: "customer.subscription.updated",
        data: { object: { ...baseSubscription, status: "incomplete" } },
      } as never);

      expect(mockPrisma.developerSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "incomplete" }),
        }),
      );
    });

    it("maps canceled status via toSubscriptionStatus in subscription.updated", async () => {
      mockPrisma.developerSubscription.findFirst.mockResolvedValue({
        id: "ds-1",
        stripePriceId: "price_old",
        stripeSubscriptionItemId: "si_old",
      });
      mockPrisma.developerSubscription.update.mockResolvedValue({});

      await DeveloperBillingService.handleWebhookEvent({
        id: "evt_15",
        type: "customer.subscription.updated",
        data: { object: { ...baseSubscription, status: "canceled" } },
      } as never);

      expect(mockPrisma.developerSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "canceled" }),
        }),
      );
    });
  });

  describe("verifyWebhook", () => {
    it("calls stripe.webhooks.constructEvent and returns the event", () => {
      const stripe = getStripeInstance();
      const fakeEvent = { type: "checkout.session.completed" };
      stripe.webhooks.constructEvent.mockReturnValue(fakeEvent);

      const result = DeveloperBillingService.verifyWebhook(
        Buffer.from("body"),
        "sig",
      );
      expect(result).toBe(fakeEvent);
    });

    it("throws when STRIPE_DEV_WEBHOOK_SECRET is not configured", () => {
      const saved = process.env.STRIPE_DEV_WEBHOOK_SECRET;
      delete process.env.STRIPE_DEV_WEBHOOK_SECRET;
      expect(() =>
        DeveloperBillingService.verifyWebhook(Buffer.from("body"), "sig"),
      ).toThrow("STRIPE_DEV_WEBHOOK_SECRET is not configured");
      process.env.STRIPE_DEV_WEBHOOK_SECRET = saved;
    });
  });
});

describe("DeveloperBillingService — module-isolated Stripe init", () => {
  it("throws when STRIPE_SECRET_KEY is not configured", async () => {
    const savedKey = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;

    let IsolatedBillingService: typeof DeveloperBillingService | undefined;

    jest.isolateModules(() => {
      jest.doMock("stripe", () => {
        const MockStripe = jest.fn().mockImplementation(() => ({
          customers: { create: jest.fn() },
          checkout: { sessions: { create: jest.fn() } },
        }));
        return { __esModule: true, default: MockStripe };
      });
      jest.doMock("../../src/config/prisma", () => ({
        prisma: { developerSubscription: { findUnique: jest.fn() } },
      }));
      const mod = jest.requireActual<{
        DeveloperBillingService: typeof DeveloperBillingService;
      }>("../../src/services/developer-billing.service");
      IsolatedBillingService = mod.DeveloperBillingService;
    });

    if (!IsolatedBillingService) throw new Error("module load failed");

    await expect(
      IsolatedBillingService.createCheckoutSession({
        ownerUserId: "o",
        successUrl: "https://a.com",
        cancelUrl: "https://b.com",
      }),
    ).rejects.toThrow("STRIPE_SECRET_KEY is not configured");

    process.env.STRIPE_SECRET_KEY = savedKey;
  });
});
