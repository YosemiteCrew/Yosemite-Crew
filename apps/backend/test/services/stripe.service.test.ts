// test/services/stripe.service.test.ts
import { StripeService } from "../../src/services/stripe.service";
import logger from "../../src/utils/logger";

// Mock Models
import InvoiceModel from "../../src/models/invoice";
import OrganizationModel from "../../src/models/organization";
import ServiceModel from "../../src/models/service";
import AppointmentModel from "../../src/models/appointment";
import { OrgBilling } from "../../src/models/organization.billing";
import { OrgUsageCounters } from "../../src/models/organisation.usage.counter";
import UserOrganizationModel from "../../src/models/user-organization";
import { NotificationService } from "../../src/services/notification.service";

// --- MOCKING SETUP ---

const mStripe = {
  accounts: { create: jest.fn() },
  accountSessions: { create: jest.fn() },
  customers: { create: jest.fn() },
  checkout: { sessions: { create: jest.fn(), retrieve: jest.fn() } },
  billingPortal: { sessions: { create: jest.fn() } },
  subscriptionItems: { update: jest.fn() },
  paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
  refunds: { create: jest.fn() },
  webhooks: { constructEvent: jest.fn() },
  charges: { retrieve: jest.fn() },
  subscriptions: { retrieve: jest.fn() },
};

jest.mock("stripe", () => jest.fn(() => mStripe));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Default Exports
jest.mock("../../src/models/invoice", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock("../../src/models/organization", () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));

jest.mock("../../src/models/service", () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));

jest.mock("../../src/models/appointment", () => ({
  __esModule: true,
  default: { findById: jest.fn(), updateOne: jest.fn() },
}));

jest.mock("../../src/models/user-organization", () => ({
  __esModule: true,
  default: { countDocuments: jest.fn() },
}));

// Named Exports
jest.mock("../../src/models/organization.billing", () => ({
  OrgBilling: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  },
}));

jest.mock("../../src/models/organisation.usage.counter", () => ({
  OrgUsageCounters: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  },
}));

jest.mock("../../src/services/invoice.service", () => ({
  InvoiceService: { attachStripeDetails: jest.fn(), markRefunded: jest.fn() },
}));

jest.mock("../../src/services/notification.service", () => ({
  NotificationService: { sendToUser: jest.fn() },
}));

jest.mock("../../src/utils/notificationTemplates", () => ({
  NotificationTemplates: {
    Payment: {
      REFUND_ISSUED: jest.fn().mockReturnValue("mock-refund-payload"),
      PAYMENT_SUCCESS: jest.fn().mockReturnValue("mock-success-payload"),
    },
  },
}));

// --- TESTS ---

describe("StripeService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks(); // CRITICAL: Fixes the blackhole coverage bug caused by mockImplementation(jest.fn())

    process.env = {
      ...originalEnv,
      STRIPE_SECRET_KEY: "sk_test_mock",
      APP_URL: "http://localhost:3000",
      STRIPE_PRICE_BUSINESS_MONTH: "price_month_mock",
      STRIPE_PRICE_BUSINESS_YEAR: "price_year_mock",
      STRIPE_WEBHOOK_SECRET: "whsec_mock",
    };

    // Default chainable lean() mocks for Mongoose
    (OrgBilling.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    (OrgUsageCounters.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("Initialization & Environment", () => {
    // Keep this test FIRST so StripeService evaluates the missing key before the singleton caches it
    it("throws if API key missing", async () => {
      const apiKey = process.env.STRIPE_SECRET_KEY;
      delete process.env.STRIPE_SECRET_KEY;
      await expect(
        StripeService.createOrGetConnectedAccount("org_1"),
      ).rejects.toThrow("STRIPE_SECRET_KEY is not configured");
      process.env.STRIPE_SECRET_KEY = apiKey;
    });
  });

  describe("createOrGetConnectedAccount", () => {
    it("should throw error if org not found", async () => {
      (OrganizationModel.findById as jest.Mock).mockResolvedValueOnce(null);
      await expect(
        StripeService.createOrGetConnectedAccount("org_1"),
      ).rejects.toThrow("Organisation not found");
    });

    it("should return existing accountId if org has one", async () => {
      (OrganizationModel.findById as jest.Mock).mockResolvedValueOnce({
        stripeAccountId: "acct_existing",
      });
      const result = await StripeService.createOrGetConnectedAccount("org_1");
      expect(result).toEqual({ accountId: "acct_existing" });
    });

    it("should create new account and update billing if org does not have one", async () => {
      const mockOrg = { _id: "org_1", stripeAccountId: null, save: jest.fn() };
      (OrganizationModel.findById as jest.Mock).mockResolvedValueOnce(mockOrg);
      mStripe.accounts.create.mockResolvedValueOnce({ id: "acct_new" });
      (OrgBilling.findOneAndUpdate as jest.Mock).mockResolvedValueOnce({});

      const result = await StripeService.createOrGetConnectedAccount("org_1");

      expect(result).toEqual({ accountId: "acct_new" });
      expect(mockOrg.stripeAccountId).toBe("acct_new");
      expect(mockOrg.save).toHaveBeenCalled();
    });
  });

  describe("getAccountStatus", () => {
    it("should throw if org not found", async () => {
      (OrganizationModel.findById as jest.Mock).mockResolvedValueOnce(null);
      await expect(StripeService.getAccountStatus("org_1")).rejects.toThrow(
        "Organistaion not found",
      );
    });

    it("should return billing and usage data", async () => {
      (OrganizationModel.findById as jest.Mock).mockResolvedValueOnce({
        _id: "org_1",
      });
      (OrgBilling.findOne as jest.Mock).mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({ plan: "free" }),
      });
      (OrgUsageCounters.findOne as jest.Mock).mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({ users: 5 }),
      });

      const result = await StripeService.getAccountStatus("org_1");
      expect(result.orgBilling).toEqual({ plan: "free" });
      expect(result.orgUsage).toEqual({ users: 5 });
    });
  });

  describe("createOnboardingLink", () => {
    it("should throw if org not found", async () => {
      (OrganizationModel.findById as jest.Mock).mockResolvedValueOnce(null);
      await expect(StripeService.createOnboardingLink("org_1")).rejects.toThrow(
        "No Organisation Found",
      );
    });

    it("should throw if org has no stripe account", async () => {
      (OrganizationModel.findById as jest.Mock).mockResolvedValueOnce({
        _id: "org_1",
      });
      (OrgBilling.findOne as jest.Mock).mockResolvedValueOnce({
        connectAccountId: null,
      });
      await expect(StripeService.createOnboardingLink("org_1")).rejects.toThrow(
        "Organisation does not have a Stripe account",
      );
    });

    it("should create account session", async () => {
      (OrganizationModel.findById as jest.Mock).mockResolvedValueOnce({
        _id: "org_1",
      });
      (OrgBilling.findOne as jest.Mock).mockResolvedValueOnce({
        connectAccountId: "acct_123",
      });
      mStripe.accountSessions.create.mockResolvedValueOnce({
        client_secret: "secret_123",
      });

      const result = await StripeService.createOnboardingLink("org_1");
      expect(result.client_secret).toBe("secret_123");
    });
  });

  describe("createBusinessCheckoutSession", () => {
    it("should throw if org not found", async () => {
      (OrganizationModel.findById as jest.Mock).mockResolvedValueOnce(null);
      await expect(
        StripeService.createBusinessCheckoutSession("org_1", "month"),
      ).rejects.toThrow("Organisation not found");
    });

    it("should throw if no billable seats", async () => {
      (OrganizationModel.findById as jest.Mock).mockResolvedValueOnce({
        _id: "org_1",
      });
      (OrgBilling.findOneAndUpdate as jest.Mock).mockResolvedValueOnce({
        connectAccountId: null,
        save: jest.fn(),
      });
      (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        {},
      );
      (UserOrganizationModel.countDocuments as jest.Mock).mockResolvedValueOnce(
        0,
      );

      await expect(
        StripeService.createBusinessCheckoutSession("org_1", "month"),
      ).rejects.toThrow("No users found");
    });

    it("should throw if missing priceId vars", async () => {
      delete process.env.STRIPE_PRICE_BUSINESS_MONTH;
      (OrganizationModel.findById as jest.Mock).mockResolvedValueOnce({
        _id: "org_1",
      });
      (OrgBilling.findOneAndUpdate as jest.Mock).mockResolvedValueOnce({
        connectAccountId: null,
        save: jest.fn(),
      });
      (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        {},
      );
      (UserOrganizationModel.countDocuments as jest.Mock).mockResolvedValueOnce(
        1,
      );

      await expect(
        StripeService.createBusinessCheckoutSession("org_1", "month"),
      ).rejects.toThrow("Missing STRIPE_PRICE_BUSINESS_* env vars");
    });

    it("should create customer and checkout session (and sync connect ID)", async () => {
      const mockBilling = {
        stripeCustomerId: null,
        save: jest.fn(),
        connectAccountId: null,
      };
      (OrganizationModel.findById as jest.Mock).mockResolvedValueOnce({
        _id: "org_1",
        name: "Test Org",
        stripeAccountId: "acct_sync",
      });
      (OrgBilling.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        mockBilling,
      );
      (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        {},
      );
      (UserOrganizationModel.countDocuments as jest.Mock).mockResolvedValueOnce(
        5,
      );

      mStripe.customers.create.mockResolvedValueOnce({ id: "cus_123" });
      mStripe.checkout.sessions.create.mockResolvedValueOnce({
        url: "http://checkout.url",
      });

      const result = await StripeService.createBusinessCheckoutSession(
        "org_1",
        "year",
      );

      expect(mockBilling.connectAccountId).toBe("acct_sync");
      expect(mockBilling.stripeCustomerId).toBe("cus_123");
      expect(result.url).toBe("http://checkout.url");
    });
  });

  describe("createCustomerPortalSession", () => {
    it("should throw if no stripeCustomerId", async () => {
      (OrgBilling.findOneAndUpdate as jest.Mock).mockResolvedValueOnce({
        stripeCustomerId: null,
      });
      (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        {},
      );
      await expect(
        StripeService.createCustomerPortalSession("org_1"),
      ).rejects.toThrow("No billing customer found");
    });

    it("should create portal session", async () => {
      (OrgBilling.findOneAndUpdate as jest.Mock).mockResolvedValueOnce({
        stripeCustomerId: "cus_123",
      });
      (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        {},
      );
      mStripe.billingPortal.sessions.create.mockResolvedValueOnce({
        url: "http://portal.url",
      });

      const result = await StripeService.createCustomerPortalSession("org_1");
      expect(result.url).toBe("http://portal.url");
    });
  });

  describe("syncSubscriptionSeats", () => {
    it("should return updated: false if not business plan", async () => {
      (OrgBilling.findOneAndUpdate as jest.Mock).mockResolvedValueOnce({
        plan: "free",
      });
      (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        {},
      );
      const res = await StripeService.syncSubscriptionSeats("org_1");
      expect(res).toEqual({ updated: false, reason: "not_business" });
    });

    it("should return updated: false if status not active/trialing/past_due", async () => {
      (OrgBilling.findOneAndUpdate as jest.Mock).mockResolvedValueOnce({
        plan: "business",
        stripeSubscriptionItemId: "item_1",
        subscriptionStatus: "canceled",
      });
      (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        {},
      );
      const res = await StripeService.syncSubscriptionSeats("org_1");
      expect(res).toEqual({
        updated: false,
        reason: "subscription_not_syncable",
      });
    });

    it("should return updated: false if missing item id", async () => {
      (OrgBilling.findOneAndUpdate as jest.Mock).mockResolvedValueOnce({
        plan: "business",
        stripeSubscriptionItemId: null,
      });
      (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        {},
      );
      const res = await StripeService.syncSubscriptionSeats("org_1");
      expect(res).toEqual({ updated: false, reason: "missing_item_id" });
    });

    it("should sync seats with none prorations if decreased", async () => {
      const mockBilling = {
        plan: "business",
        stripeSubscriptionItemId: "item_1",
        subscriptionStatus: "active",
        seatQuantity: 10,
        save: jest.fn(),
      };
      (OrgBilling.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        mockBilling,
      );
      (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        {},
      );
      (UserOrganizationModel.countDocuments as jest.Mock).mockResolvedValueOnce(
        5,
      ); // decreased

      const res = await StripeService.syncSubscriptionSeats("org_1");
      expect(res.prorationBehavior).toBe("none");
      expect(mStripe.subscriptionItems.update).toHaveBeenCalledWith("item_1", {
        quantity: 5,
        proration_behavior: "none",
      });
    });
  });

  describe("createPaymentIntentForAppointment", () => {
    it("should throw if appointment not found", async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValueOnce(null);
      await expect(
        StripeService.createPaymentIntentForAppointment("app_1"),
      ).rejects.toThrow("Appointment not found");
    });

    it("should throw if appointment does not require payment", async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValueOnce({
        status: "CONFIRMED",
      });
      await expect(
        StripeService.createPaymentIntentForAppointment("app_1"),
      ).rejects.toThrow("Appointment does not require payment");
    });

    it("should throw if service not found", async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValueOnce({
        status: "NO_PAYMENT",
        appointmentType: { id: "srv_1" },
      });
      (ServiceModel.findById as jest.Mock).mockResolvedValueOnce(null);
      await expect(
        StripeService.createPaymentIntentForAppointment("app_1"),
      ).rejects.toThrow("Service not found");
    });

    it("should throw if org has no stripe account", async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValueOnce({
        status: "NO_PAYMENT",
        appointmentType: { id: "srv_1" },
      });
      (ServiceModel.findById as jest.Mock).mockResolvedValueOnce({ cost: 100 });
      (OrganizationModel.findById as jest.Mock).mockResolvedValueOnce({
        stripeAccountId: null,
      });
      await expect(
        StripeService.createPaymentIntentForAppointment("app_1"),
      ).rejects.toThrow("Organisation has no Stripe account");
    });

    it("should create payment intent successfully", async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValueOnce({
        status: "NO_PAYMENT",
        appointmentType: { id: "srv_1" },
        organisationId: "org_1",
        companion: { id: "comp_1", parent: { id: "par_1" } },
      });
      (ServiceModel.findById as jest.Mock).mockResolvedValueOnce({ cost: 100 });
      (OrganizationModel.findById as jest.Mock).mockResolvedValueOnce({
        stripeAccountId: "acct_1",
      });
      (OrgBilling.findOne as jest.Mock).mockReturnValueOnce({
        currency: undefined,
      }); // Fallback to USD

      mStripe.paymentIntents.create.mockResolvedValueOnce({
        id: "pi_123",
        client_secret: "sec_123",
      });

      const res =
        await StripeService.createPaymentIntentForAppointment("app_1");
      expect(res.clientSecret).toBe("sec_123");
    });
  });

  describe("createPaymentIntentForInvoice", () => {
    it("should throw if invoice not found", async () => {
      (InvoiceModel.findById as jest.Mock).mockResolvedValueOnce(null);
      await expect(
        StripeService.createPaymentIntentForInvoice("inv_1"),
      ).rejects.toThrow("Invoice not found");
    });

    it("should throw if not payable", async () => {
      (InvoiceModel.findById as jest.Mock).mockResolvedValueOnce({
        status: "PAID",
      });
      await expect(
        StripeService.createPaymentIntentForInvoice("inv_1"),
      ).rejects.toThrow("Invoice is not payable");
    });

    it("should throw if switch fetch fails", async () => {
      (InvoiceModel.findById as jest.Mock)
        .mockResolvedValueOnce({
          status: "PENDING",
          paymentCollectionMethod: "PAYMENT_LINK",
          stripeCheckoutSessionId: "cs_1",
        })
        .mockResolvedValueOnce(null);
      await expect(
        StripeService.createPaymentIntentForInvoice("inv_1"),
      ).rejects.toThrow("Invoice not found after switch");
    });

    it("should throw if no stripe connected account", async () => {
      (InvoiceModel.findById as jest.Mock).mockResolvedValueOnce({
        status: "PENDING",
      });
      (OrganizationModel.findById as jest.Mock).mockResolvedValueOnce({
        stripeAccountId: null,
      });
      await expect(
        StripeService.createPaymentIntentForInvoice("inv_1"),
      ).rejects.toThrow(
        "Organisation does not have a Stripe connected account",
      );
    });
  });

  describe("createCheckoutSessionForInvoice", () => {
    it("should throw if invoice not found", async () => {
      (InvoiceModel.findById as jest.Mock).mockResolvedValueOnce(null);
      await expect(
        StripeService.createCheckoutSessionForInvoice("inv_1"),
      ).rejects.toThrow("Invoice not found");
    });

    it("should throw if invoice has payment intent", async () => {
      (InvoiceModel.findById as jest.Mock).mockResolvedValueOnce({
        status: "PENDING",
        stripePaymentIntentId: "pi_123",
      });
      await expect(
        StripeService.createCheckoutSessionForInvoice("inv_1"),
      ).rejects.toThrow("Invoice already has a PaymentIntent");
    });

    it("should throw if org not connected", async () => {
      (InvoiceModel.findById as jest.Mock).mockResolvedValueOnce({
        status: "PENDING",
      });
      (OrganizationModel.findById as jest.Mock).mockResolvedValueOnce({
        stripeAccountId: null,
      });
      await expect(
        StripeService.createCheckoutSessionForInvoice("inv_1"),
      ).rejects.toThrow("Organisation not connected to Stripe");
    });

    it("should create checkout session successfully", async () => {
      (InvoiceModel.findById as jest.Mock).mockResolvedValueOnce({
        _id: "inv_1",
        status: "PENDING",
        organisationId: "org_1",
        items: [{ name: "item1", unitPrice: 50, quantity: 2 }],
      });
      (OrganizationModel.findById as jest.Mock).mockResolvedValueOnce({
        stripeAccountId: "acct_1",
      });
      mStripe.checkout.sessions.create.mockResolvedValueOnce({
        id: "cs_123",
        url: "http://cs.url",
      });

      const res = await StripeService.createCheckoutSessionForInvoice("inv_1");
      expect(res.url).toBe("http://cs.url");
    });
  });

  describe("Simple retrieval & Refund wrappers", () => {
    it("retrievePaymentIntent", async () => {
      await StripeService.retrievePaymentIntent("pi_123");
      expect(mStripe.paymentIntents.retrieve).toHaveBeenCalledWith("pi_123");
    });

    it("retrieveCheckoutSession handles missing amount", async () => {
      mStripe.checkout.sessions.retrieve.mockResolvedValueOnce({
        payment_status: "paid",
      }); // missing amount
      const res = await StripeService.retrieveCheckoutSession("cs_123");
      expect(res).toEqual({ status: "paid", total: 0 });
    });

    it("refundPaymentIntent throws if no invoice or no charge", async () => {
      (InvoiceModel.findOne as jest.Mock).mockResolvedValueOnce(null);
      await expect(StripeService.refundPaymentIntent("pi_123")).rejects.toThrow(
        "Invoice not found",
      );

      (InvoiceModel.findOne as jest.Mock).mockResolvedValueOnce({
        _id: "inv_1",
      });
      mStripe.paymentIntents.retrieve.mockResolvedValueOnce({
        latest_charge: null,
      });
      await expect(StripeService.refundPaymentIntent("pi_123")).rejects.toThrow(
        "No charge found for PaymentIntent",
      );
    });
  });

  describe("Webhook Handlers", () => {
    it("verifyWebhook throws on missing secret", () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      expect(() => StripeService.verifyWebhook(Buffer.from(""), "sig")).toThrow(
        "STRIPE_WEBHOOK_SECRET is not configured",
      );
    });

    it("verifyWebhook throws on invalid signature format", () => {
      process.env.STRIPE_WEBHOOK_SECRET = "sec";
      expect(() =>
        StripeService.verifyWebhook(Buffer.from(""), ["sig"]),
      ).toThrow("Invalid Stripe signature header format");
    });

    it("verifyWebhook handles normal flow", () => {
      process.env.STRIPE_WEBHOOK_SECRET = "sec";
      StripeService.verifyWebhook(Buffer.from(""), "sig");
      expect(mStripe.webhooks.constructEvent).toHaveBeenCalled();
    });

    it("_handleAccountUpdated handles partial requirements", async () => {
      await StripeService._handleAccountUpdated({
        id: "acct_1",
        charges_enabled: false,
        payouts_enabled: false,
        requirements: null,
      } as any);
      expect(OrgBilling.updateOne).toHaveBeenCalled();
    });

    it("_handleSubscriptionUpdated handles absent canceled_at", async () => {
      await StripeService._handleSubscriptionUpdated({
        id: "sub_1",
        items: {
          data: [
            { quantity: 5, current_period_start: 1, current_period_end: 2 },
          ],
        },
        canceled_at: null,
      } as any);
      expect(OrgBilling.updateOne).toHaveBeenCalled();
    });

    it("_handleSubscriptionDeleted", async () => {
      await StripeService._handleSubscriptionDeleted({ id: "sub_1" } as any);
      expect(OrgBilling.updateOne).toHaveBeenCalled();
    });

    it("_handleInvoicePaid / _handleInvoicePaymentFailed handle missing sub", async () => {
      await StripeService._handleInvoicePaid({
        lines: { data: [{ subscription: null }] },
      } as any);
      await StripeService._handleInvoicePaymentFailed({
        lines: { data: [{ subscription: null }] },
      } as any);
      expect(OrgBilling.updateOne).not.toHaveBeenCalled();
    });

    it("_handleRefund aborts if no appointment or invoice", async () => {
      await StripeService._handleRefund({ metadata: {} } as any);
      (InvoiceModel.findOne as jest.Mock).mockResolvedValueOnce(null);
      await StripeService._handleRefund({
        metadata: { appointmentId: "app_1" },
      } as any);
    });

    describe("_handlePaymentSucceeded Edge Cases", () => {
      it("aborts on missing type", async () => {
        await StripeService._handlePaymentSucceeded({ metadata: {} } as any);
        expect(logger.error).toHaveBeenCalledWith(
          "payment_intent.succeeded missing metadata.type",
        );
      });

      it("logs error on unknown type", async () => {
        await StripeService._handlePaymentSucceeded({
          metadata: { type: "UNKNOWN" },
        } as any);
        expect(logger.error).toHaveBeenCalledWith(
          "Unknown payment type in metadata",
        );
      });
    });

    describe("_handleAppointmentBookingPayment Edge Cases", () => {
      it("returns early if no appointmentId, appt missing, existing invoice, or no service", async () => {
        await StripeService._handleAppointmentBookingPayment({
          metadata: {},
        } as any);

        (AppointmentModel.findById as jest.Mock).mockResolvedValueOnce(null);
        await StripeService._handleAppointmentBookingPayment({
          metadata: { appointmentId: "app_1" },
        } as any);

        (AppointmentModel.findById as jest.Mock).mockResolvedValueOnce({});
        (InvoiceModel.findOne as jest.Mock).mockResolvedValueOnce({
          id: "existing",
        });
        await StripeService._handleAppointmentBookingPayment({
          metadata: { appointmentId: "app_1" },
        } as any);

        (AppointmentModel.findById as jest.Mock).mockResolvedValueOnce({
          appointmentType: { id: "srv_1" },
        });
        (InvoiceModel.findOne as jest.Mock).mockResolvedValueOnce(null);
        mStripe.charges.retrieve.mockResolvedValueOnce({ id: "ch_1" });
        (ServiceModel.findById as jest.Mock).mockResolvedValueOnce(null);
        await StripeService._handleAppointmentBookingPayment({
          metadata: { appointmentId: "app_1" },
          latest_charge: "ch_1",
        } as any);
      });
    });

    describe("_handleInvoicePayment Edge Cases", () => {
      it("returns early if missing/paid, refunds if wrong method", async () => {
        await StripeService._handleInvoicePayment({ metadata: {} } as any);

        (InvoiceModel.findById as jest.Mock).mockResolvedValueOnce(null);
        await StripeService._handleInvoicePayment({
          metadata: { invoiceId: "inv_1" },
        } as any);

        (InvoiceModel.findById as jest.Mock).mockResolvedValueOnce({
          status: "PAID",
        });
        await StripeService._handleInvoicePayment({
          metadata: { invoiceId: "inv_1" },
        } as any);

        const refundSpy = jest
          .spyOn(StripeService, "_refundByPaymentIntentId")
          .mockImplementation(jest.fn() as any);
        (InvoiceModel.findById as jest.Mock).mockResolvedValueOnce({
          status: "PENDING",
          paymentCollectionMethod: "PAYMENT_LINK",
        });
        await StripeService._handleInvoicePayment({
          id: "pi_123",
          metadata: { invoiceId: "inv_1" },
        } as any);
        expect(refundSpy).toHaveBeenCalled();
      });

      it("successfully marks invoice PAID", async () => {
        const mockInvoice = {
          status: "PENDING",
          paymentCollectionMethod: "PAYMENT_INTENT",
          save: jest.fn(),
        };
        (InvoiceModel.findById as jest.Mock).mockResolvedValueOnce(mockInvoice);
        mStripe.charges.retrieve.mockResolvedValueOnce({
          id: "ch_1",
          receipt_url: "url",
        });

        await StripeService._handleInvoicePayment({
          id: "pi_123",
          latest_charge: "ch_1",
          metadata: { invoiceId: "inv_1" },
        } as any);
        expect(mockInvoice.status).toBe("PAID");
      });
    });

    describe("_handlePaymentFailed Edge Cases", () => {
      it("returns if no appt or invoice", async () => {
        await StripeService._handlePaymentFailed({ metadata: {} } as any);
        (InvoiceModel.findOne as jest.Mock).mockResolvedValueOnce(null);
        await StripeService._handlePaymentFailed({
          metadata: { appointmentId: "app_1" },
        } as any);
      });
    });

    describe("_handleSubscriptionCheckout Edge Cases", () => {
      it("returns if missing customer/sub", async () => {
        await StripeService._handleSubscriptionCheckout({
          customer: null,
        } as any);
      });
      it("handles string vs object product IDs", async () => {
        mStripe.subscriptions.retrieve.mockResolvedValueOnce({
          items: { data: [{ price: { product: "prod_1" } }] },
        });
        await StripeService._handleSubscriptionCheckout({
          customer: "cus_1",
          subscription: "sub_1",
        } as any);

        mStripe.subscriptions.retrieve.mockResolvedValueOnce({
          items: { data: [{ price: { product: { id: "prod_2" } } }] },
        });
        await StripeService._handleSubscriptionCheckout({
          customer: "cus_1",
          subscription: "sub_1",
        } as any);
      });
    });

    describe("_handleInvoiceCheckout Edge Cases", () => {
      it("early returns and full updates", async () => {
        await StripeService._handleInvoiceCheckout({ metadata: {} } as any);

        (InvoiceModel.findById as jest.Mock).mockResolvedValueOnce(null);
        await StripeService._handleInvoiceCheckout({
          metadata: { invoiceId: "inv_1" },
        } as any);

        (InvoiceModel.findById as jest.Mock).mockResolvedValueOnce({
          status: "PAID",
        });
        await StripeService._handleInvoiceCheckout({
          metadata: { invoiceId: "inv_1" },
        } as any);

        const refundSpy = jest
          .spyOn(StripeService, "_refundCheckoutSession")
          .mockImplementation(jest.fn() as any);
        (InvoiceModel.findById as jest.Mock).mockResolvedValueOnce({
          status: "PENDING",
          paymentCollectionMethod: "PAYMENT_INTENT",
        });
        await StripeService._handleInvoiceCheckout({
          id: "cs_1",
          metadata: { invoiceId: "inv_1" },
        } as any);
        expect(refundSpy).toHaveBeenCalled();

        (InvoiceModel.findById as jest.Mock).mockResolvedValueOnce({
          status: "PENDING",
          paymentCollectionMethod: "PAYMENT_LINK",
          appointmentId: "app_1",
          parentId: "par_1",
        });
        await StripeService._handleInvoiceCheckout({
          id: "cs_1",
          metadata: { invoiceId: "inv_1" },
        } as any);
        expect(AppointmentModel.updateOne).toHaveBeenCalled();
        expect(NotificationService.sendToUser).toHaveBeenCalled();
      });
    });

    describe("_handlePaymentSucceeded Routing", () => {
      it("routes correctly", async () => {
        const spy1 = jest
          .spyOn(StripeService, "_handleInvoicePayment")
          .mockImplementation(jest.fn() as any);
        await StripeService._handlePaymentSucceeded({
          metadata: { type: "INVOICE_PAYMENT" },
        } as any);
        expect(spy1).toHaveBeenCalled();

        const spy2 = jest
          .spyOn(StripeService, "_handleAppointmentBookingPayment")
          .mockImplementation(jest.fn() as any);
        await StripeService._handlePaymentSucceeded({
          metadata: { type: "APPOINTMENT_BOOKING" },
        } as any);
        expect(spy2).toHaveBeenCalled();
      });
    });

    describe("_handleCheckoutCompleted Routing", () => {
      it("routes correctly", async () => {
        const spy1 = jest
          .spyOn(StripeService, "_handleSubscriptionCheckout")
          .mockImplementation(jest.fn() as any);
        await StripeService._handleCheckoutCompleted({
          mode: "subscription",
        } as any);
        expect(spy1).toHaveBeenCalled();

        const spy2 = jest
          .spyOn(StripeService, "_handleInvoiceCheckout")
          .mockImplementation(jest.fn() as any);
        await StripeService._handleCheckoutCompleted({
          mode: "payment",
        } as any);
        expect(spy2).toHaveBeenCalled();
      });
    });

    describe("_refundCheckoutSession & _refundByPaymentIntentId Edge Cases", () => {
      it("ignores refund if pi not string", async () => {
        const spy = jest
          .spyOn(StripeService, "_refundByPaymentIntentId")
          .mockImplementation(jest.fn() as any);
        await StripeService._refundCheckoutSession({
          payment_intent: {},
        } as any);
        expect(spy).not.toHaveBeenCalled();
      });

      it("catches errors and handles null charges", async () => {
        mStripe.paymentIntents.retrieve.mockResolvedValueOnce({
          latest_charge: null,
        });
        await StripeService._refundByPaymentIntentId("pi_123");

        mStripe.paymentIntents.retrieve.mockRejectedValueOnce(
          new Error("API Error"),
        );
        await StripeService._refundByPaymentIntentId("pi_123");
        expect(logger.error).toHaveBeenCalled();
      });
    });

    it("handleWebhookEvent routing defaults and safety", async () => {
      await StripeService.handleWebhookEvent({ type: "UNKNOWN_EVENT" } as any);

      const cases = [
        "payment_intent.succeeded",
        "payment_intent.payment_failed",
        "charge.refunded",
        "account.updated",
        "checkout.session.completed",
        "customer.subscription.updated",
        "customer.subscription.deleted",
        "invoice.paid",
        "invoice.payment_failed",
      ];

      for (const eventType of cases) {
        await expect(
          StripeService.handleWebhookEvent({
            type: eventType,
            data: {
              object: {
                lines: { data: [{ subscription: "sub_1" }] },
                items: { data: [{ price: {} }] },
              },
            },
          } as any),
        ).resolves.not.toThrow();
      }
    });
  });
});
