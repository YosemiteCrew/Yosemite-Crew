// test/services/stripe.service.test.ts
import { StripeService } from "../../src/services/stripe.service";
import {
  FinancePaymentService,
  FinancePaymentError,
  assertInvoiceInScope,
  resolveStripeConnectedAccountId,
} from "../../src/services/finance/payment";
import { FinanceSubscriptionService } from "../../src/services/finance/subscription";
import { NotificationService } from "../../src/services/notification.service";
import logger from "../../src/utils/logger";
import { recomputeOrganizationVerification } from "../../src/services/organization-verification.service";
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

jest.mock("../../src/services/invoice.service", () => ({
  InvoiceService: { attachStripeDetails: jest.fn(), markRefunded: jest.fn() },
}));

jest.mock("../../src/services/finance/payment", () => ({
  __esModule: true,
  resolveStripeConnectedAccountId: jest.fn().mockResolvedValue(null),
  assertInvoiceInScope: jest.fn(),
  FinancePaymentError: class FinancePaymentError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
      this.name = "FinancePaymentError";
    }
  },
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

jest.mock("../../src/services/organization-verification.service", () => ({
  recomputeOrganizationVerification: jest.fn(),
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
      findMany: jest.fn(),
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

    // `account.updated` now recomputes org verification, which lists the orgs on
    // the Connect account. Prisma always returns an array here, so default to
    // one; without it every unrelated account.updated test throws "not iterable".
    (prisma.organizationBilling.findMany as jest.Mock).mockResolvedValue([]);

    // mockReset, not just the clearAllMocks above: clearAllMocks drops recorded
    // calls but NOT queued mockResolvedValueOnce values, so a test that queues
    // more responses than it consumes leaves them for whichever later test calls
    // the same mock next. That was survivable while every booking test made the
    // same number of invoice reads; it stops being survivable now that the
    // handler's read pattern differs per branch.
    (prisma.invoice.findUnique as jest.Mock).mockReset();
    (prisma.invoice.findFirst as jest.Mock).mockReset();
    (prisma.invoice.create as jest.Mock).mockReset();
    (prisma.invoice.updateMany as jest.Mock).mockReset();
    // Same reason, and this one had already bitten: a booking test that queued a
    // charge it never retrieved handed that charge to the next test that did,
    // which is how an unrelated invoice-payment test started reporting the wrong
    // receipt url and captured amount.
    mStripe.charges.retrieve.mockReset();

    // The appointment-booking handler now opens with a replay lookup and a claim
    // before it decides anything, so both need a shape by default: no invoice is
    // yet bound to this intent, and no open invoice was claimed. That is the
    // first-delivery-with-nothing-to-reuse case, which is what most of these
    // tests are about. Tests that exercise a replay or a claim override them.
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.invoice.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    process.env = {
      ...originalEnv,
      STRIPE_SECRET_KEY: "sk_test_mock",
      APP_URL: "http://localhost:3000",
      STRIPE_PRICE_BUSINESS_MONTH: "price_month_mock",
      STRIPE_PRICE_BUSINESS_YEAR: "price_year_mock",
      STRIPE_WEBHOOK_SECRET: "whsec_mock",
      STRIPE_CONNECT_WEBHOOK_SECRET: "whsec_connect_mock",
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

  describe("Webhook verification", () => {
    it("uses the platform webhook secret for platform events", () => {
      StripeService.verifyWebhook(Buffer.from("payload"), "sig_1");

      expect(mStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        Buffer.from("payload"),
        "sig_1",
        "whsec_mock",
      );
    });

    it("uses the connect webhook secret for direct-charge events", () => {
      StripeService.verifyConnectWebhook(Buffer.from("payload"), "sig_2");

      expect(mStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        Buffer.from("payload"),
        "sig_2",
        "whsec_connect_mock",
      );
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
      expect(mStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.not.objectContaining({
          transfer_data: expect.anything(),
        }),
        {
          stripeAccount: "acct_1",
        },
      );
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
        {
          stripeAccount: "acct_1",
        },
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
        {
          stripeAccount: "acct_1",
        },
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

      const result = await StripeService.createPaymentIntentForInvoice(
        "inv_1",
        {
          organisationId: "org_1",
        },
      );

      expect(
        FinancePaymentService.createPaymentIntentForInvoice,
      ).toHaveBeenCalledWith("inv_1", { organisationId: "org_1" });

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
        StripeService.createPaymentIntentForInvoice("inv_1", {
          organisationId: "org_1",
        }),
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

    it("retrieves the session on the connected account it was created on", async () => {
      (resolveStripeConnectedAccountId as jest.Mock).mockResolvedValueOnce(
        "acct_session",
      );
      mStripe.checkout.sessions.retrieve.mockResolvedValueOnce({
        payment_status: "paid",
        amount_total: 5000,
      });

      await StripeService.retrieveCheckoutSession("sess_2");

      expect(mStripe.checkout.sessions.retrieve).toHaveBeenCalledWith(
        "sess_2",
        {},
        { stripeAccount: "acct_session" },
      );
    });

    it("projects only status and total, never the raw session", async () => {
      // This route is public for the success/cancel pages.
      mStripe.checkout.sessions.retrieve.mockResolvedValueOnce({
        payment_status: "paid",
        amount_total: 999,
        customer_details: { email: "owner@example.com" },
        payment_intent: { id: "pi_secret", client_secret: "cs_secret" },
        metadata: { invoiceId: "inv_1" },
      });

      const result = await StripeService.retrieveCheckoutSession("sess_3");

      expect(Object.keys(result).sort()).toEqual(["status", "total"]);
    });
  });

  describe("retrievePaymentIntent scoping", () => {
    it("hides a payment intent belonging to another parent", async () => {
      (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
        invoice: {
          id: "inv_1",
          organisationId: "org_1",
          parentId: "parent_owner",
        },
      });
      (assertInvoiceInScope as jest.Mock).mockImplementationOnce(() => {
        throw new FinancePaymentError("Invoice not found", 404);
      });

      await expect(
        StripeService.retrievePaymentIntent("pi_1", {
          parentId: "parent_attacker",
        }),
      ).rejects.toThrow("Invoice not found");
      expect(mStripe.paymentIntents.retrieve).not.toHaveBeenCalled();
    });

    it("throws when no local attempt binds the payment intent", async () => {
      (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );

      await expect(
        StripeService.retrievePaymentIntent("pi_unknown", {
          organisationId: "org_1",
        }),
      ).rejects.toThrow("Payment intent not found");
      expect(mStripe.paymentIntents.retrieve).not.toHaveBeenCalled();
    });

    it("retrieves the payment intent on its connected account", async () => {
      (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
        invoice: { id: "inv_1", organisationId: "org_1", parentId: "parent_1" },
      });
      (resolveStripeConnectedAccountId as jest.Mock).mockResolvedValueOnce(
        "acct_pi",
      );
      mStripe.paymentIntents.retrieve.mockResolvedValueOnce({ id: "pi_1" });

      await StripeService.retrievePaymentIntent("pi_1", {
        organisationId: "org_1",
      });

      expect(mStripe.paymentIntents.retrieve).toHaveBeenCalledWith(
        "pi_1",
        {},
        { stripeAccount: "acct_pi" },
      );
    });
  });

  describe("createBusinessCheckoutSession readiness gate", () => {
    it("refuses checkout while the connected account cannot accept payments", async () => {
      (
        FinanceSubscriptionService.prepareBusinessCheckoutSession as jest.Mock
      ).mockResolvedValueOnce({
        orgName: "Test Org",
        connectAccountId: "acct_1",
        externalCustomerId: "cus_1",
        priceId: "price_month_mock",
        seats: 2,
        canAcceptPayments: false,
      });

      await expect(
        StripeService.createBusinessCheckoutSession("org_1", "month"),
      ).rejects.toThrow("Organisation cannot accept payments yet");
      expect(mStripe.checkout.sessions.create).not.toHaveBeenCalled();
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
        canAcceptPayments: true,
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
        canAcceptPayments: true,
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

    it("omits the customer field when the created customer has no id", async () => {
      (
        FinanceSubscriptionService.prepareBusinessCheckoutSession as jest.Mock
      ).mockResolvedValueOnce({
        orgName: "Test Org",
        connectAccountId: "acct_1",
        externalCustomerId: null,
        priceId: "price_month_mock",
        seats: 2,
        canAcceptPayments: true,
      });
      // Stripe returns a customer object with no usable id: the `?? undefined`
      // fallback must keep `customer` off the checkout payload (never null).
      mStripe.customers.create.mockResolvedValueOnce({ id: null });
      mStripe.checkout.sessions.create.mockResolvedValueOnce({
        url: "http://checkout.url",
      });

      const result = await StripeService.createBusinessCheckoutSession(
        "org_1",
        "month",
      );

      expect(result).toEqual({ url: "http://checkout.url" });
      expect(mStripe.customers.create).toHaveBeenCalled();
      expect(
        FinanceSubscriptionService.recordBusinessCheckoutCustomer,
      ).toHaveBeenCalledWith({
        orgId: "org_1",
        externalCustomerId: null,
      });

      const checkoutArgs = mStripe.checkout.sessions.create.mock.calls[0][0];
      expect(checkoutArgs.customer).toBeUndefined();
      expect("customer" in checkoutArgs).toBe(true);
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
      (prisma.organizationBilling.findMany as jest.Mock).mockResolvedValueOnce([
        { orgId: "org_1" },
      ]);

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

    it("recomputes verification for every org on the connected account", async () => {
      (prisma.organizationBilling.findMany as jest.Mock).mockResolvedValueOnce([
        { orgId: "org_1" },
        { orgId: "org_2" },
      ]);

      await StripeService._handleAccountUpdated({
        id: "acct_multi",
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

      expect(prisma.organizationBilling.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { connectAccountId: "acct_multi" },
          data: expect.objectContaining({ canAcceptPayments: true }),
        }),
      );
      expect(prisma.organizationBilling.findMany).toHaveBeenCalledWith({
        where: { connectAccountId: "acct_multi" },
        select: { orgId: true },
      });
      expect(recomputeOrganizationVerification).toHaveBeenCalledTimes(2);
      expect(recomputeOrganizationVerification).toHaveBeenNthCalledWith(
        1,
        "org_1",
      );
      expect(recomputeOrganizationVerification).toHaveBeenNthCalledWith(
        2,
        "org_2",
      );
    });

    it("handles appointment booking payment", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "appt_1",
        appointmentType: { id: "svc_1" },
        organisationId: "org_1",
        companion: { id: "comp_1", parent: { id: "par_1" } },
      });
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
      (prisma.invoice.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.invoice.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "inv_open" });
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
      // The claim is the point: settling without stamping the intent would leave
      // a later redelivery with nothing bound and nothing open, and it would mint
      // a second invoice.
      expect(prisma.invoice.updateMany).toHaveBeenCalledWith({
        where: {
          appointmentId: "appt_1",
          status: { in: ["AWAITING_PAYMENT", "PENDING"] },
          providerPaymentIntentId: null,
        },
        data: { providerPaymentIntentId: "pi_1" },
      });
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

    it("uses the connected account when settling direct-charge payment intents", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "appt_1",
        appointmentType: { id: "svc_1" },
        organisationId: "org_1",
        patient: { id: "comp_1", parent: { id: "par_1" } },
      });
      (prisma.invoice.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.invoice.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "inv_open" });
      (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "pa_open",
        settlementChannel: "STRIPE",
        collectionMode: null,
      });
      mStripe.charges.retrieve.mockResolvedValueOnce({
        id: "ch_connect",
        receipt_url: "receipt-connect",
      });
      (
        FinancePaymentService.handleInvoicePaymentIntentSucceeded as jest.Mock
      ).mockResolvedValueOnce({
        action: "PAID",
        invoice: { id: "inv_open" },
        paymentAttempt: { id: "pa_open" },
        payment: { id: "pay_open" },
        balanceAfterPayment: 0,
        paidToDate: 10,
        appliedAmount: 10,
      });

      await StripeService.handleWebhookEvent({
        id: "evt_1",
        type: "payment_intent.succeeded",
        account: "acct_connect_1",
        data: {
          object: {
            id: "pi_connect_1",
            currency: "usd",
            latest_charge: "ch_connect",
            metadata: {
              type: "APPOINTMENT_BOOKING",
              appointmentId: "appt_1",
            },
          },
        },
      } as any);

      expect(mStripe.charges.retrieve).toHaveBeenCalledWith("ch_connect", {
        stripeAccount: "acct_connect_1",
      });
      expect(
        FinancePaymentService.handleInvoicePaymentIntentSucceeded,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId: "inv_open",
          paymentIntentId: "pi_connect_1",
          chargeId: "ch_connect",
        }),
      );
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
        payment_status: "paid",
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

  describe("getAccountStatus missing organisation", () => {
    it("throws when the organisation row is missing", async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        StripeService.getAccountStatus("org_missing"),
      ).rejects.toThrow("Organistaion not found");
    });
  });

  describe("createPaymentIntentForAppointment guards", () => {
    it("throws when the appointment status does not allow payment", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "appt_1",
        status: "CANCELLED",
        organisationId: "org_1",
        appointmentType: { id: "service_1" },
        patient: { id: "comp_1" },
      });

      await expect(
        StripeService.createPaymentIntentForAppointment("appt_1"),
      ).rejects.toThrow("Appointment does not allow payment");
    });

    it("throws when the service row is missing", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "appt_1",
        status: "REQUESTED",
        organisationId: "org_1",
        appointmentType: { id: "service_1" },
        patient: { id: "comp_1" },
      });
      (prisma.service.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        StripeService.createPaymentIntentForAppointment("appt_1"),
      ).rejects.toThrow("Service not found");
    });

    it("throws when the organisation has no Stripe account (UPCOMING status)", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "appt_1",
        status: "UPCOMING",
        organisationId: "org_1",
        appointmentType: { id: "service_1" },
        patient: { id: "comp_1" },
      });
      (prisma.service.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "service_1",
        cost: 50,
      });
      (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        stripeAccountId: null,
      });

      await expect(
        StripeService.createPaymentIntentForAppointment("appt_1"),
      ).rejects.toThrow("Organisation has no Stripe account");
    });
  });

  describe("handleWebhookEvent dispatch", () => {
    it("routes payment_intent.payment_failed to the failure handler", async () => {
      (
        FinancePaymentService.handleInvoicePaymentFailed as jest.Mock
      ).mockResolvedValueOnce({ action: "IGNORED" });

      await StripeService.handleWebhookEvent({
        type: "payment_intent.payment_failed",
        data: { object: { id: "pi_x", metadata: {} } },
      } as any);

      expect(
        FinancePaymentService.handleInvoicePaymentFailed,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ paymentIntentId: "pi_x" }),
      );
    });

    it("routes charge.refunded to the refund handler", async () => {
      (
        FinancePaymentService.markInvoiceRefundedFromWebhook as jest.Mock
      ).mockResolvedValueOnce({ action: "IGNORED", invoice: {} });

      await StripeService.handleWebhookEvent({
        type: "charge.refunded",
        data: {
          object: {
            id: "ch_x",
            amount: 500,
            currency: "usd",
            payment_intent: "pi_x",
            metadata: { invoiceId: "inv_x" },
          },
        },
      } as any);

      expect(
        FinancePaymentService.markInvoiceRefundedFromWebhook,
      ).toHaveBeenCalled();
    });

    it("routes account.updated to the connect handler", async () => {
      (
        prisma.organizationBilling.updateMany as jest.Mock
      ).mockResolvedValueOnce({});

      await StripeService.handleWebhookEvent({
        type: "account.updated",
        data: {
          object: {
            id: "acct_x",
            charges_enabled: false,
            payouts_enabled: false,
          },
        },
      } as any);

      expect(prisma.organizationBilling.updateMany).toHaveBeenCalled();
    });

    it("routes checkout.session.completed in subscription mode", async () => {
      mStripe.subscriptions.retrieve.mockResolvedValueOnce({ id: "sub_x" });

      await StripeService.handleWebhookEvent({
        type: "checkout.session.completed",
        data: {
          object: {
            mode: "subscription",
            customer: "cus_x",
            subscription: "sub_x",
          },
        },
      } as any);

      expect(
        FinanceSubscriptionService.recordStripeSubscriptionCheckoutCompleted,
      ).toHaveBeenCalled();
    });

    it("routes checkout.session.completed in payment mode with connected account", async () => {
      (
        FinancePaymentService.handleInvoiceCheckoutSessionCompleted as jest.Mock
      ).mockResolvedValueOnce({ action: "IGNORED", invoice: {} });

      await StripeService.handleWebhookEvent({
        type: "checkout.session.completed",
        account: "acct_conn",
        data: {
          object: {
            id: "cs_x",
            mode: "payment",
            payment_status: "paid",
            metadata: { invoiceId: "inv_x" },
          },
        },
      } as any);

      expect(
        FinancePaymentService.handleInvoiceCheckoutSessionCompleted,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId: "inv_x",
          connectedAccountId: "acct_conn",
        }),
      );
    });

    it("ignores checkout.session.completed with an unhandled mode", async () => {
      await StripeService.handleWebhookEvent({
        type: "checkout.session.completed",
        data: { object: { mode: "setup" } },
      } as any);

      expect(
        FinanceSubscriptionService.recordStripeSubscriptionCheckoutCompleted,
      ).not.toHaveBeenCalled();
      expect(
        FinancePaymentService.handleInvoiceCheckoutSessionCompleted,
      ).not.toHaveBeenCalled();
    });

    it("routes customer.subscription.updated", async () => {
      await StripeService.handleWebhookEvent({
        type: "customer.subscription.updated",
        data: { object: { id: "sub_x" } },
      } as any);

      expect(
        FinanceSubscriptionService.recordStripeSubscriptionUpdated,
      ).toHaveBeenCalledWith(expect.objectContaining({ id: "sub_x" }));
    });

    it("routes customer.subscription.deleted and ignores non-string account fields", async () => {
      await StripeService.handleWebhookEvent({
        type: "customer.subscription.deleted",
        account: 123,
        data: { object: { id: "sub_x" } },
      } as any);

      expect(
        FinanceSubscriptionService.recordSubscriptionDeleted,
      ).toHaveBeenCalledWith("sub_x");
    });

    it("routes invoice.paid", async () => {
      await StripeService.handleWebhookEvent({
        type: "invoice.paid",
        data: {
          object: { id: "in_x", lines: { data: [{ subscription: "sub_x" }] } },
        },
      } as any);

      expect(
        FinanceSubscriptionService.recordSubscriptionInvoicePaid,
      ).toHaveBeenCalledWith({ subscriptionId: "sub_x", invoiceId: "in_x" });
    });

    it("routes invoice.payment_failed", async () => {
      await StripeService.handleWebhookEvent({
        type: "invoice.payment_failed",
        data: {
          object: { id: "in_x", lines: { data: [{ subscription: "sub_x" }] } },
        },
      } as any);

      expect(
        FinanceSubscriptionService.recordSubscriptionInvoiceFailed,
      ).toHaveBeenCalledWith({ subscriptionId: "sub_x", invoiceId: "in_x" });
    });

    it("logs unhandled Stripe event types without throwing", async () => {
      await StripeService.handleWebhookEvent({
        type: "customer.created",
        data: { object: {} },
      } as any);

      expect(logger.info).toHaveBeenCalledWith(
        "Unhandled Stripe event: customer.created",
      );
    });
  });

  describe("_handlePaymentSucceeded routing", () => {
    it("ignores events missing metadata.type", async () => {
      await StripeService._handlePaymentSucceeded({
        id: "pi_1",
        metadata: {},
      } as any);

      expect(logger.error).toHaveBeenCalledWith(
        "payment_intent.succeeded missing metadata.type",
      );
      expect(
        FinancePaymentService.handleInvoicePaymentIntentSucceeded,
      ).not.toHaveBeenCalled();
    });

    it("logs unknown payment types", async () => {
      await StripeService._handlePaymentSucceeded({
        id: "pi_1",
        metadata: { type: "MYSTERY" },
      } as any);

      expect(logger.error).toHaveBeenCalledWith(
        "Unknown payment type in metadata",
      );
    });

    it("routes INVOICE_PAYMENT to the invoice handler", async () => {
      (
        FinancePaymentService.handleInvoicePaymentIntentSucceeded as jest.Mock
      ).mockResolvedValueOnce({ action: "IGNORED", invoice: {} });

      await StripeService._handlePaymentSucceeded({
        id: "pi_1",
        latest_charge: null,
        metadata: { type: "INVOICE_PAYMENT", invoiceId: "inv_1" },
      } as any);

      expect(
        FinancePaymentService.handleInvoicePaymentIntentSucceeded,
      ).toHaveBeenCalledWith(expect.objectContaining({ invoiceId: "inv_1" }));
    });
  });

  describe("_handleInvoicePayment captured amount and result branches", () => {
    it("ignores payment intents without an invoiceId", async () => {
      await StripeService._handleInvoicePayment({
        id: "pi_1",
        metadata: {},
      } as any);

      expect(
        FinancePaymentService.handleInvoicePaymentIntentSucceeded,
      ).not.toHaveBeenCalled();
    });

    it("resolves the captured amount from the charge (positive path)", async () => {
      (
        FinancePaymentService.handleInvoicePaymentIntentSucceeded as jest.Mock
      ).mockResolvedValueOnce({
        action: "PAID",
        invoice: {
          id: "inv_1",
          parentId: "p",
          totalAmount: 50,
          currency: "usd",
        },
      });
      mStripe.charges.retrieve.mockResolvedValueOnce({
        id: "ch_1",
        receipt_url: "r",
        amount_captured: 5000,
      });

      await StripeService._handleInvoicePayment({
        id: "pi_1",
        currency: "usd",
        latest_charge: "ch_1",
        metadata: { invoiceId: "inv_1" },
      } as any);

      expect(
        FinancePaymentService.handleInvoicePaymentIntentSucceeded,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 50, chargeId: "ch_1" }),
      );
      expect(logger.info).toHaveBeenCalledWith("Invoice inv_1 marked PAID");
    });

    it("falls back to amount_received when there is no charge", async () => {
      (
        FinancePaymentService.handleInvoicePaymentIntentSucceeded as jest.Mock
      ).mockResolvedValueOnce({
        action: "PAID",
        invoice: {
          id: "inv_1",
          parentId: "p",
          totalAmount: 30,
          currency: "usd",
        },
      });

      await StripeService._handleInvoicePayment({
        id: "pi_1",
        currency: "usd",
        latest_charge: null,
        amount_received: 3000,
        metadata: { invoiceId: "inv_1" },
      } as any);

      expect(mStripe.charges.retrieve).not.toHaveBeenCalled();
      expect(
        FinancePaymentService.handleInvoicePaymentIntentSucceeded,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 30, chargeId: null }),
      );
    });

    it("reports a null captured amount when a charge captured nothing", async () => {
      (
        FinancePaymentService.handleInvoicePaymentIntentSucceeded as jest.Mock
      ).mockResolvedValueOnce({
        action: "MISSING_AMOUNT",
        invoice: { id: "inv_1" },
      });
      mStripe.charges.retrieve.mockResolvedValueOnce({
        id: "ch_1",
        receipt_url: null,
        amount_captured: 0,
      });

      await StripeService._handleInvoicePayment({
        id: "pi_1",
        latest_charge: "ch_1",
        metadata: { invoiceId: "inv_1" },
      } as any);

      expect(
        FinancePaymentService.handleInvoicePaymentIntentSucceeded,
      ).toHaveBeenCalledWith(expect.objectContaining({ amount: null }));
      expect(logger.error).toHaveBeenCalledWith(
        "Invoice inv_1 payment rejected: no captured amount reported",
      );
    });

    it("logs when the invoice was already refunded", async () => {
      (
        FinancePaymentService.handleInvoicePaymentIntentSucceeded as jest.Mock
      ).mockResolvedValueOnce({ action: "REFUNDED", invoice: { id: "inv_1" } });
      mStripe.charges.retrieve.mockResolvedValueOnce({
        id: "ch_1",
        receipt_url: null,
      });

      await StripeService._handleInvoicePayment({
        id: "pi_1",
        latest_charge: "ch_1",
        metadata: { invoiceId: "inv_1" },
      } as any);

      expect(logger.warn).toHaveBeenCalledWith(
        "Invoice inv_1 refunded from payment-intent webhook",
      );
    });

    it("logs when the event account does not match the invoice organisation", async () => {
      (
        FinancePaymentService.handleInvoicePaymentIntentSucceeded as jest.Mock
      ).mockResolvedValueOnce({ action: "ACCOUNT_MISMATCH" });
      mStripe.charges.retrieve.mockResolvedValueOnce({
        id: "ch_1",
        receipt_url: null,
      });

      await StripeService._handleInvoicePayment({
        id: "pi_1",
        latest_charge: "ch_1",
        metadata: { invoiceId: "inv_1" },
      } as any);

      expect(logger.error).toHaveBeenCalledWith(
        "Invoice inv_1 payment rejected: event account does not match the invoice organisation",
      );
    });
  });

  describe("_handlePaymentFailed", () => {
    it("does not warn when the failure was not applied", async () => {
      (
        FinancePaymentService.handleInvoicePaymentFailed as jest.Mock
      ).mockResolvedValueOnce({ action: "IGNORED" });

      await StripeService._handlePaymentFailed({
        id: "pi_1",
        metadata: { invoiceId: "inv_1", appointmentId: "appt_1" },
      } as any);

      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe("_handleRefund guards", () => {
    it("returns without notifying when the refund was not applied", async () => {
      (
        FinancePaymentService.markInvoiceRefundedFromWebhook as jest.Mock
      ).mockResolvedValueOnce({
        action: "IGNORED",
        invoice: { id: "inv_1", parentId: "par_1" },
      });

      await StripeService._handleRefund({
        id: "ch_1",
        payment_intent: "pi_1",
        amount: 500,
        currency: "usd",
        metadata: { invoiceId: "inv_1" },
      } as any);

      expect(NotificationService.sendToUser).not.toHaveBeenCalled();
    });

    it("returns without notifying when the refunded invoice has no parent", async () => {
      (
        FinancePaymentService.markInvoiceRefundedFromWebhook as jest.Mock
      ).mockResolvedValueOnce({
        action: "REFUNDED",
        invoice: { id: "inv_1", parentId: null },
      });

      await StripeService._handleRefund({
        id: "ch_1",
        payment_intent: null,
        amount: 500,
        currency: "usd",
        refunded: true,
        metadata: {},
      } as any);

      expect(
        FinancePaymentService.markInvoiceRefundedFromWebhook,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentIntentId: null,
          reason: "Refunded via Stripe",
        }),
      );
      expect(NotificationService.sendToUser).not.toHaveBeenCalled();
    });
  });

  describe("_handleInvoicePaid / _handleInvoicePaymentFailed subscription resolution", () => {
    it("resolves the subscription id from an object and a null invoice id", async () => {
      await StripeService._handleInvoicePaid({
        id: null,
        lines: { data: [{ subscription: { id: "sub_obj" } }] },
      } as any);

      expect(
        FinanceSubscriptionService.recordSubscriptionInvoicePaid,
      ).toHaveBeenCalledWith({ subscriptionId: "sub_obj", invoiceId: null });
    });

    it("ignores paid invoices with no subscription", async () => {
      await StripeService._handleInvoicePaid({
        id: "in_1",
        lines: { data: [{}] },
      } as any);

      expect(
        FinanceSubscriptionService.recordSubscriptionInvoicePaid,
      ).not.toHaveBeenCalled();
    });

    it("resolves the subscription id from an object for failed invoices", async () => {
      await StripeService._handleInvoicePaymentFailed({
        id: "in_1",
        lines: { data: [{ subscription: { id: "sub_obj" } }] },
      } as any);

      expect(
        FinanceSubscriptionService.recordSubscriptionInvoiceFailed,
      ).toHaveBeenCalledWith({ subscriptionId: "sub_obj", invoiceId: "in_1" });
    });

    it("ignores failed invoices with no subscription", async () => {
      await StripeService._handleInvoicePaymentFailed({
        id: "in_1",
        lines: { data: [] },
      } as any);

      expect(
        FinanceSubscriptionService.recordSubscriptionInvoiceFailed,
      ).not.toHaveBeenCalled();
    });
  });

  describe("_handleAccountUpdated fallbacks", () => {
    it("defaults enablement fields when the account omits them", async () => {
      (
        prisma.organizationBilling.updateMany as jest.Mock
      ).mockResolvedValueOnce({});

      await StripeService._handleAccountUpdated({ id: "acct_x" } as any);

      expect(prisma.organizationBilling.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { connectAccountId: "acct_x" },
          data: expect.objectContaining({
            canAcceptPayments: false,
            connectChargesEnabled: false,
            connectPayoutsEnabled: false,
          }),
        }),
      );
    });

    it("stores the disabled reason and requirements when present", async () => {
      (
        prisma.organizationBilling.updateMany as jest.Mock
      ).mockResolvedValueOnce({});

      await StripeService._handleAccountUpdated({
        id: "acct_y",
        charges_enabled: true,
        payouts_enabled: false,
        default_currency: "eur",
        requirements: {
          disabled_reason: "requirements.past_due",
          currently_due: ["x"],
          eventually_due: ["y"],
          past_due: ["z"],
          pending_verification: ["w"],
          errors: [{ reason: "r" }],
        },
      } as any);

      expect(prisma.organizationBilling.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            canAcceptPayments: false,
            connectDisabledReason: "requirements.past_due",
            currency: "eur",
          }),
        }),
      );
    });
  });

  describe("_handleCheckoutCompleted subscription guard", () => {
    it("ignores subscription checkouts missing the customer or subscription", async () => {
      await StripeService._handleSubscriptionCheckout({
        customer: null,
        subscription: "sub_1",
      } as any);

      expect(mStripe.subscriptions.retrieve).not.toHaveBeenCalled();
      expect(
        FinanceSubscriptionService.recordStripeSubscriptionCheckoutCompleted,
      ).not.toHaveBeenCalled();
    });
  });

  describe("_handleInvoiceCheckout payment status gate", () => {
    // `checkout.session.completed` fires when the checkout finished, not when the
    // money arrived. A delayed payment method leaves payment_status `unpaid` and
    // settles later, so acting on the completion event alone marked the invoice
    // paid before any funds existed.
    it.each(["unpaid", undefined])(
      "ignores a session whose payment_status is %s",
      async (paymentStatus) => {
        await StripeService._handleInvoiceCheckout({
          id: "cs_pending",
          payment_status: paymentStatus,
          metadata: { invoiceId: "inv_1" },
        } as never);

        expect(
          FinancePaymentService.handleInvoiceCheckoutSessionCompleted,
        ).not.toHaveBeenCalled();
      },
    );

    it("settles a zero-total session that needed no payment", async () => {
      (
        FinancePaymentService.handleInvoiceCheckoutSessionCompleted as jest.Mock
      ).mockResolvedValueOnce({ action: "IGNORED", invoice: { id: "inv_1" } });

      await StripeService._handleInvoiceCheckout({
        id: "cs_free",
        payment_status: "no_payment_required",
        metadata: { invoiceId: "inv_1" },
      } as never);

      expect(
        FinancePaymentService.handleInvoiceCheckoutSessionCompleted,
      ).toHaveBeenCalled();
    });
  });

  describe("_handleInvoiceCheckout result branches", () => {
    it("ignores sessions without an invoiceId", async () => {
      await StripeService._handleInvoiceCheckout({
        id: "cs_1",
        metadata: {},
      } as any);

      expect(
        FinancePaymentService.handleInvoiceCheckoutSessionCompleted,
      ).not.toHaveBeenCalled();
    });

    it("returns on a REFUNDED checkout result", async () => {
      (
        FinancePaymentService.handleInvoiceCheckoutSessionCompleted as jest.Mock
      ).mockResolvedValueOnce({
        action: "REFUNDED",
        invoice: { id: "inv_1", parentId: "par_1" },
      });

      await StripeService._handleInvoiceCheckout({
        id: "cs_1",
        payment_status: "paid",
        metadata: { invoiceId: "inv_1" },
      } as any);

      expect(NotificationService.sendToUser).not.toHaveBeenCalled();
    });

    it("returns when a paid checkout invoice has no parent", async () => {
      (
        FinancePaymentService.handleInvoiceCheckoutSessionCompleted as jest.Mock
      ).mockResolvedValueOnce({
        action: "PAID",
        invoice: {
          id: "inv_1",
          parentId: null,
          totalAmount: 10,
          currency: "usd",
        },
      });

      await StripeService._handleInvoiceCheckout({
        id: "cs_1",
        payment_status: "paid",
        metadata: { invoiceId: "inv_1" },
      } as any);

      expect(NotificationService.sendToUser).not.toHaveBeenCalled();
    });

    it("forwards computed amounts and notifies on a paid checkout", async () => {
      (
        FinancePaymentService.handleInvoiceCheckoutSessionCompleted as jest.Mock
      ).mockResolvedValueOnce({
        action: "PAID",
        invoice: {
          id: "inv_1",
          parentId: "par_1",
          totalAmount: 100,
          currency: "usd",
        },
      });

      await StripeService._handleInvoiceCheckout(
        {
          id: "cs_1",
          payment_status: "paid",
          payment_intent: "pi_1",
          currency: "usd",
          amount_subtotal: 9000,
          amount_total: 10000,
          total_details: { amount_tax: 1000 },
          automatic_tax: { status: "complete" },
          metadata: { invoiceId: "inv_1" },
        } as any,
        "acct_conn",
      );

      expect(
        FinancePaymentService.handleInvoiceCheckoutSessionCompleted,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId: "inv_1",
          sessionId: "cs_1",
          connectedAccountId: "acct_conn",
          paymentIntentId: "pi_1",
          amountSubtotal: 90,
          amountTotal: 100,
          amountTax: 10,
          automaticTaxStatus: "complete",
        }),
      );
      expect(NotificationService.sendToUser).toHaveBeenCalledWith(
        "par_1",
        "mock-success-payload",
      );
    });
  });

  describe("_handleAppointmentBookingPayment guards", () => {
    it("ignores events without an appointmentId", async () => {
      await StripeService._handleAppointmentBookingPayment({
        id: "pi_1",
        metadata: {},
      } as any);

      expect(prisma.appointment.findUnique).not.toHaveBeenCalled();
    });

    it("ignores events when the appointment is gone", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await StripeService._handleAppointmentBookingPayment({
        id: "pi_1",
        metadata: { appointmentId: "appt_1" },
      } as any);

      expect(prisma.invoice.findUnique).not.toHaveBeenCalled();
    });

    const bookingAppointment = () =>
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "appt_1",
        appointmentType: { id: "svc_1" },
        organisationId: "org_1",
        patient: { id: "c" },
      });

    const bookingService = () =>
      (prisma.service.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "svc_1",
        name: "Checkup",
        description: "desc",
        cost: 25,
      });

    const bookingEvent = {
      id: "pi_1",
      currency: "usd",
      latest_charge: "ch_1",
      metadata: { appointmentId: "appt_1" },
    };

    it("no-ops when an invoice is already bound to this payment intent", async () => {
      // The replay case. Stripe redelivers on any non-2xx and nothing upstream
      // deduplicates by event id, so this is the ordinary path for a retry, not
      // an edge case.
      bookingAppointment();
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_bound",
      });

      await StripeService._handleAppointmentBookingPayment(bookingEvent as any);

      expect(prisma.invoice.findUnique).toHaveBeenCalledWith({
        where: { providerPaymentIntentId: "pi_1" },
        select: { id: true },
      });
      expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
      expect(prisma.invoice.create).not.toHaveBeenCalled();
      expect(mStripe.charges.retrieve).not.toHaveBeenCalled();
    });

    it("stamps the payment intent on the invoice it mints", async () => {
      // Without this assertion the whole guarantee can be deleted by removing one
      // line: a unique index over a column nothing ever writes enforces nothing,
      // and every other test here would stay green.
      bookingAppointment();
      bookingService();
      (prisma.invoice.create as jest.Mock).mockResolvedValueOnce({
        id: "inv_new",
      });
      mStripe.charges.retrieve.mockResolvedValueOnce({
        id: "ch_1",
        receipt_url: "receipt",
      });

      await StripeService._handleAppointmentBookingPayment(bookingEvent as any);

      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ providerPaymentIntentId: "pi_1" }),
        }),
      );
    });

    it("settles nothing when it loses the race for the payment intent", async () => {
      // Postgres raises 23505 only after the winner commits, so this re-read
      // cannot miss it. The winner settles; this delivery must not.
      bookingAppointment();
      bookingService();
      (prisma.invoice.create as jest.Mock).mockRejectedValueOnce({
        code: "P2002",
      });
      (prisma.invoice.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "inv_winner" });

      await StripeService._handleAppointmentBookingPayment(bookingEvent as any);

      expect(
        FinancePaymentService.handleInvoicePaymentIntentSucceeded,
      ).not.toHaveBeenCalled();
      expect(mStripe.charges.retrieve).not.toHaveBeenCalled();
    });

    it("logs and returns when the appointment key blocks a second intent", async () => {
      // A collision that is NOT on the intent means the appointment already has
      // an invoice. Throwing would answer non-2xx and buy an endless Stripe retry
      // of an event that cannot succeed while that index stands.
      bookingAppointment();
      bookingService();
      (prisma.invoice.create as jest.Mock).mockRejectedValueOnce({
        code: "P2002",
      });

      await expect(
        StripeService._handleAppointmentBookingPayment(bookingEvent as any),
      ).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("could not be recorded"),
        expect.anything(),
      );
      expect(
        FinancePaymentService.handleInvoicePaymentIntentSucceeded,
      ).not.toHaveBeenCalled();
    });

    it("rethrows a create failure that is not a unique violation", async () => {
      bookingAppointment();
      bookingService();
      (prisma.invoice.create as jest.Mock).mockRejectedValueOnce(
        new Error("connection reset"),
      );

      await expect(
        StripeService._handleAppointmentBookingPayment(bookingEvent as any),
      ).rejects.toThrow("connection reset");
    });

    it("settles from an expanded charge without a second round trip", async () => {
      // latest_charge is string | Charge | null. When the intent was expanded it
      // IS the charge, so treating anything non-string as absent skipped
      // settlement on a payment that had already been captured.
      bookingAppointment();
      bookingService();
      (prisma.invoice.create as jest.Mock).mockResolvedValueOnce({
        id: "inv_new",
      });

      await StripeService._handleAppointmentBookingPayment({
        ...bookingEvent,
        latest_charge: { id: "ch_expanded", receipt_url: "receipt" },
      } as any);

      expect(mStripe.charges.retrieve).not.toHaveBeenCalled();
      expect(
        FinancePaymentService.handleInvoicePaymentIntentSucceeded,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ chargeId: "ch_expanded" }),
      );
    });

    it("does not settle when the intent carries no usable charge id", async () => {
      bookingAppointment();
      bookingService();
      (prisma.invoice.create as jest.Mock).mockResolvedValueOnce({
        id: "inv_new",
      });

      await StripeService._handleAppointmentBookingPayment({
        ...bookingEvent,
        latest_charge: null,
      } as any);

      expect(mStripe.charges.retrieve).not.toHaveBeenCalled();
      expect(
        FinancePaymentService.handleInvoicePaymentIntentSucceeded,
      ).not.toHaveBeenCalled();
    });

    it("stops when the appointment service ref is unusable", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "appt_1",
        appointmentType: null,
        organisationId: "org_1",
        patient: { id: "c" },
      });
      (prisma.invoice.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mStripe.charges.retrieve.mockResolvedValueOnce({
        id: "ch_1",
        receipt_url: null,
      });

      await StripeService._handleAppointmentBookingPayment({
        id: "pi_1",
        currency: "usd",
        latest_charge: "ch_1",
        metadata: { appointmentId: "appt_1" },
      } as any);

      expect(prisma.invoice.create).not.toHaveBeenCalled();
    });

    it("stops when the service row is missing", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "appt_1",
        appointmentType: { id: "svc_1" },
        organisationId: "org_1",
        patient: { id: "c" },
      });
      (prisma.invoice.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mStripe.charges.retrieve.mockResolvedValueOnce({
        id: "ch_1",
        receipt_url: null,
      });
      (prisma.service.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await StripeService._handleAppointmentBookingPayment({
        id: "pi_1",
        currency: "usd",
        latest_charge: "ch_1",
        metadata: { appointmentId: "appt_1" },
      } as any);

      expect(prisma.invoice.create).not.toHaveBeenCalled();
    });
  });

  describe("_refundByPaymentIntentId", () => {
    it("delegates to the finance refund helper", async () => {
      (
        FinancePaymentService.refundPaymentIntent as jest.Mock
      ).mockResolvedValueOnce(undefined);

      await StripeService._refundByPaymentIntentId("pi_1");

      expect(FinancePaymentService.refundPaymentIntent).toHaveBeenCalledWith(
        "pi_1",
      );
    });

    it("swallows and logs errors from the refund helper", async () => {
      const boom = new Error("boom");
      (
        FinancePaymentService.refundPaymentIntent as jest.Mock
      ).mockRejectedValueOnce(boom);

      await expect(
        StripeService._refundByPaymentIntentId("pi_1"),
      ).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to auto-refund payment intent",
        "pi_1",
        boom,
      );
    });
  });

  describe("verifyWebhookWithSecret guards", () => {
    it("throws when the signature header is missing", () => {
      expect(() =>
        StripeService.verifyWebhookWithSecret(
          Buffer.from("p"),
          undefined,
          "whsec",
        ),
      ).toThrow("Missing Stripe signature header");
    });

    it("rejects array signature headers", () => {
      expect(() =>
        StripeService.verifyWebhookWithSecret(
          Buffer.from("p"),
          ["a", "b"],
          "whsec",
        ),
      ).toThrow("Invalid Stripe signature header format");
    });

    it("throws when the webhook secret is not configured", () => {
      expect(() =>
        StripeService.verifyWebhookWithSecret(
          Buffer.from("p"),
          "sig",
          undefined,
        ),
      ).toThrow("Stripe webhook secret is not configured");
    });
  });

  describe("refundPaymentIntent guard", () => {
    it("throws when no attempt binds the payment intent", async () => {
      (prisma.paymentAttempt.findFirst as jest.Mock).mockReset();
      (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );

      await expect(StripeService.refundPaymentIntent("pi_x")).rejects.toThrow(
        "Invoice not found",
      );
    });
  });

  describe("connected-account and fallback branches", () => {
    it("retrieves a payment intent without a connected account", async () => {
      (prisma.paymentAttempt.findFirst as jest.Mock).mockReset();
      (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
        invoice: { id: "inv_1", organisationId: "org_1", parentId: "p" },
      });
      (resolveStripeConnectedAccountId as jest.Mock).mockResolvedValueOnce(
        null,
      );
      mStripe.paymentIntents.retrieve.mockResolvedValueOnce({ id: "pi_1" });

      await StripeService.retrievePaymentIntent("pi_1", {
        organisationId: "org_1",
      });

      expect(mStripe.paymentIntents.retrieve).toHaveBeenCalledWith(
        "pi_1",
        {},
        {},
      );
    });

    it("returns a zero total when the checkout session has no amount", async () => {
      mStripe.checkout.sessions.retrieve.mockResolvedValueOnce({
        payment_status: "unpaid",
        amount_total: null,
      });

      const result = await StripeService.retrieveCheckoutSession("sess_z");
      expect(result).toEqual({ status: "unpaid", total: 0 });
    });

    it("defaults the connect account id to empty string when it is null", async () => {
      (
        FinanceSubscriptionService.prepareBusinessCheckoutSession as jest.Mock
      ).mockResolvedValueOnce({
        orgName: "Org",
        connectAccountId: null,
        externalCustomerId: null,
        priceId: "price_month_mock",
        seats: 1,
        canAcceptPayments: true,
      });
      mStripe.customers.create.mockResolvedValueOnce({ id: "cus_null" });
      mStripe.checkout.sessions.create.mockResolvedValueOnce({
        url: "http://x",
      });

      const result = await StripeService.createBusinessCheckoutSession(
        "org_1",
        "month",
      );

      expect(result).toEqual({ url: "http://x" });
      expect(mStripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ connectAccountId: "" }),
        }),
      );
      expect(mStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_data: expect.objectContaining({
            metadata: expect.objectContaining({ connectAccountId: "" }),
          }),
        }),
      );
    });

    it("creates a payment intent when the appointment has no patient refs", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "appt_1",
        status: "REQUESTED",
        organisationId: "org_1",
        appointmentType: { id: "service_1" },
        patient: null,
      });
      (prisma.service.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "service_1",
        cost: 100,
      });
      (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        stripeAccountId: "acct_1",
      });
      mStripe.paymentIntents.create.mockResolvedValueOnce({
        id: "pi_np",
        client_secret: "cs_np",
      });

      await StripeService.createPaymentIntentForAppointment("appt_1");

      expect(mStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ parentId: "", patientId: "" }),
        }),
        { stripeAccount: "acct_1" },
      );
    });

    it("retrieves the invoice charge on the connected account", async () => {
      (
        FinancePaymentService.handleInvoicePaymentIntentSucceeded as jest.Mock
      ).mockResolvedValueOnce({ action: "IGNORED", invoice: {} });
      mStripe.charges.retrieve.mockResolvedValueOnce({
        id: "ch_1",
        receipt_url: "r",
        amount_captured: 100,
      });

      await StripeService._handleInvoicePayment(
        {
          id: "pi_1",
          currency: "usd",
          latest_charge: "ch_1",
          metadata: { invoiceId: "inv_1" },
        } as any,
        "acct_conn",
      );

      expect(mStripe.charges.retrieve).toHaveBeenCalledWith("ch_1", {
        stripeAccount: "acct_conn",
      });
    });

    it("passes a null invoice id when a failed subscription invoice has none", async () => {
      await StripeService._handleInvoicePaymentFailed({
        id: null,
        lines: { data: [{ subscription: "sub_x" }] },
      } as any);

      expect(
        FinanceSubscriptionService.recordSubscriptionInvoiceFailed,
      ).toHaveBeenCalledWith({ subscriptionId: "sub_x", invoiceId: null });
    });

    it("settles an open appointment invoice with null fallbacks on a connected account", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "appt_1",
        appointmentType: { id: "svc_1" },
        organisationId: "org_1",
        companion: {},
      });
      (prisma.invoice.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.invoice.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "inv_open" });
      mStripe.charges.retrieve.mockResolvedValueOnce({
        id: "ch_1",
        receipt_url: null,
      });
      (
        FinancePaymentService.handleInvoicePaymentIntentSucceeded as jest.Mock
      ).mockResolvedValueOnce({ action: "PAID", invoice: { id: "inv_open" } });

      await StripeService._handleAppointmentBookingPayment(
        {
          id: "pi_1",
          latest_charge: "ch_1",
          metadata: { appointmentId: "appt_1" },
        } as any,
        "acct_conn",
      );

      expect(mStripe.charges.retrieve).toHaveBeenCalledWith("ch_1", {
        stripeAccount: "acct_conn",
      });
      expect(
        FinancePaymentService.handleInvoicePaymentIntentSucceeded,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ receiptUrl: null, currency: null }),
      );
    });

    it("creates a paid appointment invoice with fallback fields on a connected account", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "appt_1",
        appointmentType: { id: "svc_1" },
        organisationId: "org_1",
        companion: {},
      });
      (prisma.invoice.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mStripe.charges.retrieve.mockResolvedValueOnce({
        id: "ch_1",
        receipt_url: null,
      });
      (prisma.service.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "svc_1",
        name: "Checkup",
        description: null,
        cost: 25,
      });
      (prisma.invoice.create as jest.Mock).mockResolvedValueOnce({
        id: "inv_new",
      });
      (
        FinancePaymentService.handleInvoicePaymentIntentSucceeded as jest.Mock
      ).mockResolvedValueOnce({ action: "PAID", invoice: { id: "inv_new" } });

      await StripeService._handleAppointmentBookingPayment(
        {
          id: "pi_1",
          latest_charge: "ch_1",
          metadata: { appointmentId: "appt_1" },
        } as any,
        "acct_conn",
      );

      expect(mStripe.charges.retrieve).toHaveBeenCalledWith("ch_1", {
        stripeAccount: "acct_conn",
      });
      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currency: "usd",
            parentId: undefined,
            patientId: undefined,
          }),
        }),
      );
      expect(
        FinancePaymentService.handleInvoicePaymentIntentSucceeded,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ receiptUrl: null, currency: null }),
      );
    });
  });
});
