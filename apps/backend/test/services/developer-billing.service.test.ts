import {
  DeveloperBillingService,
  DeveloperBillingServiceError,
} from "../../src/services/developer-billing.service";
import { prisma } from "../../src/config/prisma";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    developerSubscription: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("stripe", () => {
  const mockCustomersCreate = jest.fn();
  const mockCheckoutSessionsCreate = jest.fn();
  const mockBillingPortalCreate = jest.fn();
  const mockSubscriptionsRetrieve = jest.fn();
  const mockWebhooksConstructEvent = jest.fn();
  const mockMeterEventsCreate = jest.fn();

  const MockStripe = jest.fn().mockImplementation(() => ({
    customers: { create: mockCustomersCreate },
    checkout: { sessions: { create: mockCheckoutSessionsCreate } },
    billingPortal: { sessions: { create: mockBillingPortalCreate } },
    subscriptions: { retrieve: mockSubscriptionsRetrieve },
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
  };
};

const getStripeInstance = () => {
  const Stripe = jest.requireMock("stripe").default;
  return new Stripe();
};

describe("DeveloperBillingService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_key";
    process.env.STRIPE_DEV_METERED_PRICE_ID = "price_metered_abc";
    process.env.STRIPE_DEV_WEBHOOK_SECRET = "whsec_test";
  });

  describe("getSubscription", () => {
    it("returns the record when found", async () => {
      const record = {
        id: "sub-1",
        organisationId: "org-1",
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

    it("throws 400 on empty organisationId", async () => {
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
          where: { organisationId: "org-1" },
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
        organisationId: "org-1",
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

    it("throws 400 on empty organisationId", async () => {
      await expect(
        DeveloperBillingService.createCheckoutSession({
          organisationId: "",
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
          organisationId: "org-1",
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
          organisationId: "org-1",
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
        organisationId: "org-1",
        returnUrl: "https://app.com/billing",
      });

      expect(url).toBe("https://billing.stripe.com/session");
    });

    it("throws 404 when no Stripe customer exists", async () => {
      mockPrisma.developerSubscription.findUnique.mockResolvedValue(null);

      await expect(
        DeveloperBillingService.createPortalSession({
          organisationId: "org-1",
          returnUrl: "https://app.com/billing",
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("throws 400 on empty organisationId", async () => {
      await expect(
        DeveloperBillingService.createPortalSession({
          organisationId: "",
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
            metadata: { organisationId: "org-1" },
          },
        },
      } as never);

      expect(mockPrisma.developerSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organisationId: "org-1" },
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
  });
});
