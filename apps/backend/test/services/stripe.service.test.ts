// test/services/stripe.service.test.ts
import { StripeService } from "../../src/services/stripe.service";
import { FinancePaymentService } from "../../src/services/finance/payment";
import { FinanceSubscriptionService } from "../../src/services/finance/subscription";
import { NotificationService } from "../../src/services/notification.service";
import { prisma } from "src/config/prisma";

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

jest.mock("src/utils/dual-write", () => ({
  shouldDualWrite: false,
  isDualWriteStrict: false,
  handleDualWriteError: jest.fn(),
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

jest.mock("../../src/services/invoice.service", () => ({
  InvoiceService: { attachStripeDetails: jest.fn(), markRefunded: jest.fn() },
}));

jest.mock("../../src/services/finance/payment", () => ({
  __esModule: true,
  FinancePaymentService: {
    createPaymentIntentForInvoice: jest.fn(),
    createCheckoutSessionForInvoice: jest.fn(),
    refundInvoicePayment: jest.fn(),
    handleInvoicePaymentIntentSucceeded: jest.fn(),
    handleInvoiceCheckoutSessionCompleted: jest.fn(),
    markInvoiceRefundedFromWebhook: jest.fn(),
    handleInvoicePaymentFailed: jest.fn(),
    refundPaymentIntent: jest.fn(),
  },
}));

jest.mock("../../src/services/finance/subscription", () => ({
  __esModule: true,
  FinanceSubscriptionService: {
    prepareBusinessCheckoutSession: jest.fn(),
    resolveSubscriptionSeatSyncPlan: jest.fn(),
    recordBusinessCheckoutCustomer: jest.fn(),
    resolveBillingCustomerId: jest.fn(),
    recordSeatUsage: jest.fn(),
    recordBusinessCheckoutCompleted: jest.fn(),
    recordStripeSubscriptionUpdated: jest.fn(),
    recordStripeSubscriptionCheckoutCompleted: jest.fn(),
    recordSubscriptionUpdated: jest.fn(),
    recordSubscriptionDeleted: jest.fn(),
    recordSubscriptionInvoicePaid: jest.fn(),
    recordSubscriptionInvoiceFailed: jest.fn(),
  },
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

jest.mock("src/config/prisma", () => ({
  prisma: {
    organization: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    organizationAddress: {
      findUnique: jest.fn(),
    },
    organizationBilling: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    organizationUsageCounter: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    appointment: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    service: {
      findUnique: jest.fn(),
    },
    invoice: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    paymentAttempt: {
      findFirst: jest.fn(),
    },
    userOrganization: {
      count: jest.fn(),
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

  describe("createOrGetConnectedAccount (postgres)", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("should throw if organisation missing", async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        StripeService.createOrGetConnectedAccount("org_1"),
      ).rejects.toThrow("Organisation not found");
    });

    it("should return existing account id", async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "org_1",
        stripeAccountId: "acct_existing",
      });

      const result = await StripeService.createOrGetConnectedAccount("org_1");
      expect(result).toEqual({ accountId: "acct_existing" });
    });

    it("should create account and persist to postgres", async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "org_1",
        stripeAccountId: null,
      });
      mStripe.accounts.create.mockResolvedValueOnce({ id: "acct_new" });
      (prisma.organization.update as jest.Mock).mockResolvedValueOnce({});
      (prisma.organizationBilling.upsert as jest.Mock).mockResolvedValueOnce(
        {},
      );

      const result = await StripeService.createOrGetConnectedAccount("org_1");
      expect(result).toEqual({ accountId: "acct_new" });
      expect(prisma.organization.update).toHaveBeenCalled();
      expect(prisma.organizationBilling.upsert).toHaveBeenCalled();
    });
  });

  describe("getAccountStatus (postgres)", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("should return billing and usage rows", async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "org_1",
      });
      (
        prisma.organizationBilling.findUnique as jest.Mock
      ).mockResolvedValueOnce({ orgId: "org_1" });
      (
        prisma.organizationUsageCounter.findUnique as jest.Mock
      ).mockResolvedValueOnce({ orgId: "org_1" });

      const result = await StripeService.getAccountStatus("org_1");
      expect(result).toEqual({
        orgBilling: { orgId: "org_1" },
        orgUsage: { orgId: "org_1" },
      });
    });
  });

  describe("createOnboardingLink (postgres)", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("should throw if connect account missing", async () => {
      (
        prisma.organizationBilling.findUnique as jest.Mock
      ).mockResolvedValueOnce(null);

      await expect(StripeService.createOnboardingLink("org_1")).rejects.toThrow(
        "Organisation does not have a Stripe account",
      );
    });

    it("should return client_secret", async () => {
      (
        prisma.organizationBilling.findUnique as jest.Mock
      ).mockResolvedValueOnce({ connectAccountId: "acct_1" });
      mStripe.accountSessions.create.mockResolvedValueOnce({
        client_secret: "cs_test",
      });

      const result = await StripeService.createOnboardingLink("org_1");
      expect(result).toEqual({ client_secret: "cs_test" });
    });
  });

  describe("createPaymentIntentForAppointment (postgres)", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("should create payment intent", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "appt_1",
        status: "REQUESTED",
        organisationId: "org_1",
        appointmentType: { id: "service_1" },
        companion: { id: "comp_1", parent: { id: "parent_1" } },
      });
      (prisma.service.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "service_1",
        cost: 120,
      });
      (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        stripeAccountId: "acct_1",
      });
      mStripe.paymentIntents.create.mockResolvedValueOnce({
        id: "pi_1",
        client_secret: "cs_1",
      });

      const result =
        await StripeService.createPaymentIntentForAppointment("appt_1");

      expect(result).toEqual({
        paymentIntentId: "pi_1",
        clientSecret: "cs_1",
        amount: 120,
        currency: "usd",
      });
    });

    it("should throw if appointment not found", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce(null);
      await expect(
        StripeService.createPaymentIntentForAppointment("appt_404"),
      ).rejects.toThrow("Appointment not found");
    });

    it("should throw if appointmentType is missing", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "appt_1",
        status: "REQUESTED",
        organisationId: "org_1",
        appointmentType: null,
        companion: { id: "comp_1", parent: { id: "parent_1" } },
      });

      await expect(
        StripeService.createPaymentIntentForAppointment("appt_1"),
      ).rejects.toThrow("Service not found");
    });

    it("should throw if appointmentType id is invalid", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "appt_1",
        status: "REQUESTED",
        organisationId: "org_1",
        appointmentType: { id: 123 },
        companion: { id: "comp_1", parent: { id: "parent_1" } },
      });

      await expect(
        StripeService.createPaymentIntentForAppointment("appt_1"),
      ).rejects.toThrow("Service not found");
    });

    it("creates payment intent even if companion refs are missing", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "appt_1",
        status: "REQUESTED",
        organisationId: "org_1",
        appointmentType: { id: "service_1" },
        companion: "invalid",
      });
      (prisma.service.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "service_1",
        cost: 100,
      });
      (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        stripeAccountId: "acct_1",
      });
      (
        prisma.organizationBilling.findUnique as jest.Mock
      ).mockResolvedValueOnce({ currency: "usd" });
      mStripe.paymentIntents.create.mockResolvedValueOnce({
        id: "pi_123",
        client_secret: "sec_123",
      });

      await StripeService.createPaymentIntentForAppointment("appt_1");

      expect(mStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            parentId: "",
            companionId: "",
          }),
        }),
      );
    });

    it("creates payment intent when companion ids are not strings", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "appt_1",
        status: "REQUESTED",
        organisationId: "org_1",
        appointmentType: { id: "service_1" },
        companion: { id: 123, parent: { id: 456 } },
      });
      (prisma.service.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "service_1",
        cost: 100,
      });
      (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        stripeAccountId: "acct_1",
      });
      (
        prisma.organizationBilling.findUnique as jest.Mock
      ).mockResolvedValueOnce({ currency: "usd" });
      mStripe.paymentIntents.create.mockResolvedValueOnce({
        id: "pi_124",
        client_secret: "sec_124",
      });

      await StripeService.createPaymentIntentForAppointment("appt_1");

      expect(mStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            parentId: "",
            companionId: "",
          }),
        }),
      );
    });
  });

  describe("createPaymentIntentForInvoice (postgres)", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("should create payment intent for payable invoice", async () => {
      (
        FinancePaymentService.createPaymentIntentForInvoice as jest.Mock
      ).mockResolvedValueOnce({
        paymentIntentId: "pi_inv",
        clientSecret: "cs_inv",
        amount: 50,
        currency: "usd",
      });

      const result = await StripeService.createPaymentIntentForInvoice("inv_1");

      expect(
        FinancePaymentService.createPaymentIntentForInvoice,
      ).toHaveBeenCalledWith("inv_1");

      expect(result).toEqual({
        paymentIntentId: "pi_inv",
        clientSecret: "cs_inv",
        amount: 50,
        currency: "usd",
      });
    });

    it("should throw if invoice is not payable", async () => {
      (
        FinancePaymentService.createPaymentIntentForInvoice as jest.Mock
      ).mockRejectedValueOnce(new Error("Invoice is not payable"));
      await expect(
        StripeService.createPaymentIntentForInvoice("inv_1"),
      ).rejects.toThrow("Invoice is not payable");
    });
  });

  describe("createCheckoutSessionForInvoice (postgres)", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("should return existing checkout session", async () => {
      (
        FinancePaymentService.createCheckoutSessionForInvoice as jest.Mock
      ).mockResolvedValueOnce({
        sessionId: "sess_1",
        url: "http://checkout",
        paymentAttemptId: null,
      });

      const result =
        await StripeService.createCheckoutSessionForInvoice("inv_1");
      expect(result).toEqual({
        sessionId: "sess_1",
        url: "http://checkout",
        paymentAttemptId: null,
      });
    });

    it("should create checkout session for invoice", async () => {
      (
        FinancePaymentService.createCheckoutSessionForInvoice as jest.Mock
      ).mockResolvedValueOnce({
        sessionId: "sess_new",
        url: "http://checkout.new",
        paymentAttemptId: "pa_1",
      });

      const result =
        await StripeService.createCheckoutSessionForInvoice("inv_2");

      expect(
        FinancePaymentService.createCheckoutSessionForInvoice,
      ).toHaveBeenCalledWith("inv_2");
      expect(result).toEqual({
        sessionId: "sess_new",
        url: "http://checkout.new",
        paymentAttemptId: "pa_1",
      });
    });
  });

  describe("retrieveCheckoutSession", () => {
    it("should normalize checkout session totals", async () => {
      mStripe.checkout.sessions.retrieve.mockResolvedValueOnce({
        payment_status: "paid",
        amount_total: 12300,
      });

      const result = await StripeService.retrieveCheckoutSession("sess_1");
      expect(result).toEqual({ status: "paid", total: 123 });
    });
  });

  describe("refundPaymentIntent (postgres)", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("should refund and mark invoice", async () => {
      (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "inv_1",
        invoiceId: "inv_1",
      });
      (
        FinancePaymentService.refundInvoicePayment as jest.Mock
      ).mockResolvedValueOnce({
        invoice: { id: "inv_1" },
        refund: {
          refundId: "re_1",
          status: "succeeded",
          amountRefunded: 50,
          paymentId: "pay_1",
        },
      });

      const result = await StripeService.refundPaymentIntent("pi_1");

      expect(FinancePaymentService.refundInvoicePayment).toHaveBeenCalledWith(
        "inv_1",
      );

      expect(result).toEqual({
        refundId: "re_1",
        status: "succeeded",
        amountRefunded: 50,
      });
    });
  });

  describe("createBusinessCheckoutSession (postgres)", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("should surface finance helper errors", async () => {
      (
        FinanceSubscriptionService.prepareBusinessCheckoutSession as jest.Mock
      ).mockRejectedValueOnce(new Error("Organisation not found"));
      await expect(
        StripeService.createBusinessCheckoutSession("org_1", "month"),
      ).rejects.toThrow("Organisation not found");
    });

    it("should create customer and checkout session when no customer exists", async () => {
      (
        FinanceSubscriptionService.prepareBusinessCheckoutSession as jest.Mock
      ).mockResolvedValueOnce({
        orgName: "Test Org",
        connectAccountId: "acct_1",
        externalCustomerId: null,
        priceId: "price_month_mock",
        seats: 3,
      });
      mStripe.customers.create.mockResolvedValueOnce({ id: "cus_1" });
      mStripe.checkout.sessions.create.mockResolvedValueOnce({
        url: "http://checkout.url",
      });

      const result = await StripeService.createBusinessCheckoutSession(
        "org_1",
        "month",
      );

      expect(result).toEqual({ url: "http://checkout.url" });
      expect(
        FinanceSubscriptionService.prepareBusinessCheckoutSession,
      ).toHaveBeenCalledWith("org_1", "month");
      expect(mStripe.customers.create).toHaveBeenCalledWith({
        name: "Test Org",
        metadata: {
          orgId: "org_1",
          connectAccountId: "acct_1",
        },
      });
      expect(
        FinanceSubscriptionService.recordBusinessCheckoutCustomer,
      ).toHaveBeenCalledWith({
        orgId: "org_1",
        externalCustomerId: "cus_1",
      });
      expect(mStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "subscription",
          customer: "cus_1",
          line_items: [
            {
              price: "price_month_mock",
              quantity: 3,
            },
          ],
          automatic_tax: { enabled: true },
          tax_id_collection: { enabled: true },
          metadata: {
            orgId: "org_1",
            interval: "month",
            seats: "3",
          },
        }),
      );
    });

    it("should reuse an existing stripe customer", async () => {
      (
        FinanceSubscriptionService.prepareBusinessCheckoutSession as jest.Mock
      ).mockResolvedValueOnce({
        orgName: "Test Org",
        connectAccountId: "acct_1",
        externalCustomerId: "cus_existing",
        priceId: "price_year_mock",
        seats: 4,
      });
      mStripe.checkout.sessions.create.mockResolvedValueOnce({
        url: "http://checkout.url",
      });

      const result = await StripeService.createBusinessCheckoutSession(
        "org_1",
        "year",
      );

      expect(result).toEqual({ url: "http://checkout.url" });
      expect(mStripe.customers.create).not.toHaveBeenCalled();
      expect(prisma.organizationBilling.update).not.toHaveBeenCalled();
      expect(mStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: "cus_existing",
          line_items: [
            {
              price: "price_year_mock",
              quantity: 4,
            },
          ],
          metadata: {
            orgId: "org_1",
            interval: "year",
            seats: "4",
          },
        }),
      );
    });
  });

  describe("createCustomerPortalSession (postgres)", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.userOrganization.count as jest.Mock).mockReset();
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("should throw if no externalCustomerId", async () => {
      (
        FinanceSubscriptionService.resolveBillingCustomerId as jest.Mock
      ).mockResolvedValueOnce({ externalCustomerId: null });

      await expect(
        StripeService.createCustomerPortalSession("org_1"),
      ).rejects.toThrow(
        "No billing customer found. Upgrade to Business first.",
      );
    });

    it("should create portal session", async () => {
      (
        FinanceSubscriptionService.resolveBillingCustomerId as jest.Mock
      ).mockResolvedValueOnce({ externalCustomerId: "cus_123" });
      mStripe.billingPortal.sessions.create.mockResolvedValueOnce({
        url: "http://portal.url",
      });

      const result = await StripeService.createCustomerPortalSession("org_1");
      expect(result).toEqual({ url: "http://portal.url" });
      expect(
        FinanceSubscriptionService.resolveBillingCustomerId,
      ).toHaveBeenCalledWith("org_1");
    });
  });

  describe("syncSubscriptionSeats (postgres)", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("should return no_change when seats match", async () => {
      (
        FinanceSubscriptionService.resolveSubscriptionSeatSyncPlan as jest.Mock
      ).mockResolvedValueOnce(null);

      const result = await StripeService.syncSubscriptionSeats("org_1");
      expect(result).toEqual({ updated: false, reason: "no_change" });
      expect(mStripe.subscriptionItems.update).not.toHaveBeenCalled();
    });

    it("should sync seats when increased", async () => {
      (
        FinanceSubscriptionService.resolveSubscriptionSeatSyncPlan as jest.Mock
      ).mockResolvedValueOnce({
        subscriptionItemId: "item_1",
        oldSeats: 2,
        newSeats: 5,
        prorationBehavior: "create_prorations",
      });

      const result = await StripeService.syncSubscriptionSeats("org_1");
      expect(result).toEqual({
        updated: true,
        oldSeats: 2,
        newSeats: 5,
        prorationBehavior: "create_prorations",
      });
      expect(mStripe.subscriptionItems.update).toHaveBeenCalledWith("item_1", {
        quantity: 5,
        proration_behavior: "create_prorations",
      });
      expect(FinanceSubscriptionService.recordSeatUsage).toHaveBeenCalledWith({
        orgId: "org_1",
        seats: 5,
      });
      expect(
        FinanceSubscriptionService.resolveSubscriptionSeatSyncPlan,
      ).toHaveBeenCalledWith("org_1");
    });
  });

  describe("Webhook Handlers (postgres)", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("handles account/subscription/invoice updates", async () => {
      (
        FinanceSubscriptionService.recordStripeSubscriptionUpdated as jest.Mock
      ).mockResolvedValueOnce(undefined);
      (
        FinanceSubscriptionService.recordSubscriptionDeleted as jest.Mock
      ).mockResolvedValueOnce(undefined);
      (
        FinanceSubscriptionService.recordSubscriptionInvoicePaid as jest.Mock
      ).mockResolvedValueOnce(undefined);
      (
        FinanceSubscriptionService.recordSubscriptionInvoiceFailed as jest.Mock
      ).mockResolvedValueOnce(undefined);

      await StripeService._handleAccountUpdated({
        id: "acct_1",
        charges_enabled: true,
        payouts_enabled: true,
        default_currency: "usd",
        requirements: {
          currently_due: [],
          eventually_due: [],
          past_due: [],
          pending_verification: [],
          errors: [],
          disabled_reason: null,
        },
      } as any);

      await StripeService._handleSubscriptionUpdated({
        id: "sub_1",
        status: "active",
        cancel_at_period_end: false,
        canceled_at: null,
        items: {
          data: [
            {
              quantity: 2,
              current_period_start: 1,
              current_period_end: 2,
            },
          ],
        },
      } as any);

      await StripeService._handleSubscriptionDeleted({
        id: "sub_1",
      } as any);

      await StripeService._handleInvoicePaid({
        id: "in_1",
        lines: { data: [{ subscription: "sub_1" }] },
      } as any);

      await StripeService._handleInvoicePaymentFailed({
        id: "in_1",
        lines: { data: [{ subscription: "sub_1" }] },
      } as any);

      expect(
        FinanceSubscriptionService.recordStripeSubscriptionUpdated,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ id: "sub_1", status: "active" }),
      );
      expect(
        FinanceSubscriptionService.recordSubscriptionDeleted,
      ).toHaveBeenCalledWith("sub_1");
      expect(
        FinanceSubscriptionService.recordSubscriptionInvoicePaid,
      ).toHaveBeenCalledWith({
        subscriptionId: "sub_1",
        invoiceId: "in_1",
      });
      expect(
        FinanceSubscriptionService.recordSubscriptionInvoiceFailed,
      ).toHaveBeenCalledWith({
        subscriptionId: "sub_1",
        invoiceId: "in_1",
      });
    });

    it("handles appointment booking payment", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "appt_1",
        appointmentType: { id: "svc_1" },
        organisationId: "org_1",
        companion: { id: "comp_1", parent: { id: "par_1" } },
      });
      (prisma.invoice.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      (prisma.invoice.create as jest.Mock).mockResolvedValueOnce({
        id: "inv_new",
      });
      mStripe.charges.retrieve.mockResolvedValueOnce({
        id: "ch_1",
        receipt_url: "receipt",
      });
      (prisma.service.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "svc_1",
        name: "Checkup",
        description: "desc",
        cost: 25,
      });

      await StripeService._handleAppointmentBookingPayment({
        id: "pi_1",
        currency: "usd",
        latest_charge: "ch_1",
        metadata: { appointmentId: "appt_1" },
      } as any);

      expect(prisma.invoice.create).toHaveBeenCalled();
      expect(prisma.appointment.updateMany).toHaveBeenCalled();
    });

    it("settles open invoice for appointment booking payment", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "appt_1",
        appointmentType: { id: "svc_1" },
        organisationId: "org_1",
        companion: { id: "comp_1", parent: { id: "par_1" } },
      });
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "inv_open",
        status: "AWAITING_PAYMENT",
      });
      (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "pa_open",
      });
      mStripe.charges.retrieve.mockResolvedValueOnce({
        id: "ch_1",
        receipt_url: "receipt",
      });

      await StripeService._handleAppointmentBookingPayment({
        id: "pi_1",
        currency: "usd",
        latest_charge: "ch_1",
        metadata: { appointmentId: "appt_1" },
      } as any);

      expect(prisma.appointment.updateMany).toHaveBeenCalled();
      expect(prisma.invoice.create).not.toHaveBeenCalled();
    });

    it("handles invoice payment and failure/refund flows", async () => {
      (
        FinancePaymentService.handleInvoicePaymentIntentSucceeded as jest.Mock
      ).mockResolvedValueOnce({
        action: "PAID",
        invoice: {
          id: "inv_1",
          parentId: "par_1",
          totalAmount: 10,
          currency: "usd",
        },
      });
      (
        FinancePaymentService.handleInvoicePaymentFailed as jest.Mock
      ).mockResolvedValueOnce({
        action: "FAILED",
        invoice: { id: "inv_2" },
      });
      (
        FinancePaymentService.markInvoiceRefundedFromWebhook as jest.Mock
      ).mockResolvedValueOnce({
        action: "REFUNDED",
        invoice: { id: "inv_3", parentId: "par_1" },
      });
      mStripe.charges.retrieve.mockResolvedValueOnce({
        id: "ch_1",
        receipt_url: "receipt",
      });

      await StripeService._handleInvoicePayment({
        id: "pi_1",
        latest_charge: "ch_1",
        metadata: { invoiceId: "inv_1" },
      } as any);

      await StripeService._handlePaymentFailed({
        id: "pi_2",
        metadata: { appointmentId: "appt_1" },
      } as any);

      await StripeService._handleRefund({
        id: "ch_1",
        payment_intent: "pi_3",
        metadata: { invoiceId: "inv_3" },
        amount: 1000,
        currency: "usd",
      } as any);

      expect(
        FinancePaymentService.handleInvoicePaymentIntentSucceeded,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId: "inv_1",
          paymentIntentId: "pi_1",
          receiptUrl: "receipt",
        }),
      );
      expect(
        FinancePaymentService.handleInvoicePaymentFailed,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          appointmentId: "appt_1",
          paymentIntentId: "pi_2",
        }),
      );
      expect(
        FinancePaymentService.markInvoiceRefundedFromWebhook,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId: "inv_3",
          paymentIntentId: "pi_3",
          chargeId: "ch_1",
        }),
      );
      expect(NotificationService.sendToUser).toHaveBeenCalled();
    });

    it("ignores checkout-session invoice payment_intent events in postgres mode", async () => {
      const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;
      process.env.READ_FROM_POSTGRES = "true";

      (
        FinancePaymentService.handleInvoicePaymentIntentSucceeded as jest.Mock
      ).mockResolvedValueOnce({
        action: "IGNORED",
        invoice: { id: "inv_checkout" },
      });

      await StripeService._handleInvoicePayment({
        id: "pi_checkout",
        metadata: { invoiceId: "inv_checkout" },
      } as any);

      expect(
        FinancePaymentService.handleInvoicePaymentIntentSucceeded,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId: "inv_checkout",
          paymentIntentId: "pi_checkout",
        }),
      );

      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("handles subscription and invoice checkout", async () => {
      mStripe.subscriptions.retrieve.mockResolvedValueOnce({
        id: "sub_1",
        status: "active",
        cancel_at_period_end: false,
        items: {
          data: [
            {
              id: "item_1",
              quantity: 2,
              current_period_start: 1,
              current_period_end: 2,
              price: {
                id: "price_1",
                recurring: { interval: "month" },
                product: "prod_1",
              },
            },
          ],
        },
      });

      await StripeService._handleSubscriptionCheckout({
        customer: "cus_1",
        subscription: "sub_1",
        livemode: false,
      } as any);

      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_1",
        status: "PENDING",
        paymentCollectionMethod: "PAYMENT_LINK",
        appointmentId: "appt_1",
        parentId: "par_1",
        totalAmount: 10,
        currency: "usd",
      });
      (
        FinancePaymentService.handleInvoiceCheckoutSessionCompleted as jest.Mock
      ).mockResolvedValueOnce({
        action: "PAID",
        invoice: {
          id: "inv_1",
          parentId: "par_1",
          totalAmount: 10,
          currency: "usd",
        },
      });

      await StripeService._handleInvoiceCheckout({
        id: "cs_1",
        metadata: { invoiceId: "inv_1" },
      } as any);

      expect(
        FinanceSubscriptionService.recordStripeSubscriptionCheckoutCompleted,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: "cus_1",
          session: expect.objectContaining({
            customer: "cus_1",
            subscription: "sub_1",
          }),
          subscription: expect.objectContaining({
            id: "sub_1",
          }),
        }),
      );
      expect(
        FinancePaymentService.handleInvoiceCheckoutSessionCompleted,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId: "inv_1",
          sessionId: "cs_1",
        }),
      );
      expect(NotificationService.sendToUser).toHaveBeenCalled();
    });
  });
});
