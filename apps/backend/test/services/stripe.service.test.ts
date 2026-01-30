import { Types } from "mongoose";
import Stripe from "stripe";
import { StripeService } from "../../src/services/stripe.service";
import OrganizationModel from "../../src/models/organization";
import InvoiceModel from "../../src/models/invoice";
import AppointmentModel from "../../src/models/appointment";
import ServiceModel from "../../src/models/service";
import UserOrganizationModel from "../../src/models/user-organization";
import { OrgBilling } from "../../src/models/organization.billing";
import { OrgUsageCounters } from "../../src/models/organisation.usage.counter";
import { InvoiceService } from "../../src/services/invoice.service";
import { NotificationService } from "../../src/services/notification.service";
import logger from "../../src/utils/logger";

// --- Configuration ---
process.env.STRIPE_SECRET_KEY = "sk_test_123";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_123";
process.env.STRIPE_PRICE_BUSINESS_MONTH = "price_biz_mo";
process.env.STRIPE_PRICE_BUSINESS_YEAR = "price_biz_yr";
process.env.APP_URL = "http://localhost:3000";

// --- Mocks ---
jest.mock("stripe");
jest.mock("../../src/models/organization");
jest.mock("../../src/models/invoice");
jest.mock("../../src/models/appointment");
jest.mock("../../src/models/service");
jest.mock("../../src/models/user-organization");
jest.mock("../../src/models/organization.billing");
jest.mock("../../src/models/organisation.usage.counter");
jest.mock("../../src/services/invoice.service");
jest.mock("../../src/services/notification.service");
jest.mock("../../src/utils/logger");

// --- Helper: Mock Document ---
const mockDoc = (data: any) => ({
  ...data,
  save: jest.fn().mockResolvedValue(data),
  toObject: jest.fn(() => data),
});

// --- Helper: Mongoose Chain Mock ---
const mockChain = (result: any = null) => {
  return {
    lean: jest.fn().mockResolvedValue(result),
    select: jest.fn().mockReturnThis(),
    setOptions: jest.fn().mockReturnThis(),
    // IMPORTANT: If result is an object (doc), return it so .save() works.
    save: jest.fn().mockResolvedValue(result),
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  } as any;
};

describe("StripeService", () => {
  let stripeInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Stripe Instance methods with comprehensive default returns
    stripeInstance = {
      accounts: { create: jest.fn().mockResolvedValue({ id: "acct_new" }) },
      accountSessions: { create: jest.fn().mockResolvedValue({ client_secret: "secret" }) },
      customers: { create: jest.fn().mockResolvedValue({ id: "cus_new" }) },
      checkout: {
        sessions: {
          create: jest.fn().mockResolvedValue({ id: "cs_1", url: "http://checkout" }),
          retrieve: jest.fn().mockResolvedValue({ payment_status: "paid", amount_total: 5000 })
        }
      },
      billingPortal: { sessions: { create: jest.fn().mockResolvedValue({ url: "http://portal" }) } },
      subscriptionItems: { update: jest.fn() },
      subscriptions: {
        retrieve: jest.fn().mockResolvedValue({
          id: "sub_1",
          items: { data: [{
            id: "si_1", quantity: 1,
            price: { id: "p1" },
            current_period_start: 0, current_period_end: 1
          }] },
          status: "active",
          cancel_at_period_end: false
        })
      },
      paymentIntents: {
        create: jest.fn().mockResolvedValue({ id: "pi_1", client_secret: "sec_1" }),
        retrieve: jest.fn().mockResolvedValue({
          id: "pi_existing",
          latest_charge: { id: "ch_1", receipt_url: "http://receipt" }
        })
      },
      refunds: { create: jest.fn().mockResolvedValue({ id: "re_1", status: "succeeded", amount: 1000 }) },
      charges: { retrieve: jest.fn().mockResolvedValue({ id: "ch_1", receipt_url: "http://receipt" }) },
      webhooks: { constructEvent: jest.fn() },
    };
    (Stripe as unknown as jest.Mock).mockImplementation(() => stripeInstance);

    // Default Mongoose Mocks
    // Use mockDoc for queries that might lead to .save()
    (OrganizationModel.findById as jest.Mock).mockReturnValue(mockChain(null));
    (OrgBilling.findOne as jest.Mock).mockReturnValue(mockChain(null));
    (OrgBilling.findOneAndUpdate as jest.Mock).mockReturnValue(mockChain(mockDoc({})));
    (OrgUsageCounters.findOne as jest.Mock).mockReturnValue(mockChain(null));
    (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockReturnValue(mockChain(mockDoc({})));
    (UserOrganizationModel.countDocuments as jest.Mock).mockResolvedValue(5);
    (InvoiceModel.updateOne as jest.Mock).mockResolvedValue({});
  });

  describe("Connect & Onboarding", () => {
    it("createOrGetConnectedAccount: returns existing account", async () => {
      (OrganizationModel.findById as jest.Mock).mockReturnValue(
        mockChain(mockDoc({ _id: "org-1", stripeAccountId: "acct_existing" }))
      );
      const res = await StripeService.createOrGetConnectedAccount("org-1");
      expect(res.accountId).toBe("acct_existing");
      expect(stripeInstance.accounts.create).not.toHaveBeenCalled();
    });

    it("createOrGetConnectedAccount: creates new account", async () => {
      (OrganizationModel.findById as jest.Mock).mockReturnValue(
        mockDoc({ _id: "org-1", stripeAccountId: null })
      );

      const res = await StripeService.createOrGetConnectedAccount("org-1");

      expect(res.accountId).toBe("acct_new");
      expect(OrgBilling.findOneAndUpdate).toHaveBeenCalled();
    });

    it("getAccountStatus: throws if org not found", async () => {
      await expect(StripeService.getAccountStatus("bad-id")).rejects.toThrow("Organistaion not found");
    });

    it("getAccountStatus: returns billing and usage", async () => {
      (OrganizationModel.findById as jest.Mock).mockReturnValue(mockChain({ _id: "org-1" }));
      (OrgBilling.findOne as jest.Mock).mockReturnValue(mockChain({ plan: "pro" }));
      const res = await StripeService.getAccountStatus("org-1");
      expect(res.orgBilling).toBeDefined();
    });

    it("createOnboardingLink: creates session", async () => {
      (OrganizationModel.findById as jest.Mock).mockReturnValue(mockChain({ _id: "org-1" }));
      (OrgBilling.findOne as jest.Mock).mockReturnValue(mockChain({ connectAccountId: "acct_1" }));
      const res = await StripeService.createOnboardingLink("org-1");
      expect(res.client_secret).toBe("secret");
    });

    it("createOnboardingLink: throws if no connect account", async () => {
      (OrganizationModel.findById as jest.Mock).mockReturnValue(mockChain({ _id: "org-1" }));
      (OrgBilling.findOne as jest.Mock).mockReturnValue(mockChain(null));
      await expect(StripeService.createOnboardingLink("org-1")).rejects.toThrow("Organisation does not have a Stripe account");
    });
  });

  describe("SaaS Subscription", () => {
    it("createBusinessCheckoutSession: throws if no seats", async () => {
      (OrganizationModel.findById as jest.Mock).mockReturnValue(mockChain({}));
      (UserOrganizationModel.countDocuments as jest.Mock).mockResolvedValue(0);
      await expect(StripeService.createBusinessCheckoutSession("org-1", "month")).rejects.toThrow("No users found");
    });

    it("createCustomerPortalSession: creates portal session", async () => {
      (OrgBilling.findOneAndUpdate as jest.Mock).mockReturnValue(mockChain({ stripeCustomerId: "cus_1" }));
      const res = await StripeService.createCustomerPortalSession("org-1");
      expect(res.url).toBe("http://portal");
    });

    it("syncSubscriptionSeats: skips if counts match", async () => {
      const billingDoc = mockDoc({
        plan: "business", stripeSubscriptionItemId: "si_1", subscriptionStatus: "active", seatQuantity: 5
      });
      (OrgBilling.findOneAndUpdate as jest.Mock).mockReturnValue(mockChain(billingDoc));
      const res = await StripeService.syncSubscriptionSeats("org-1");
      expect(res.updated).toBe(false);
    });
  });

  describe("Payment Intents (Appointment & Invoice)", () => {
    it("createPaymentIntentForAppointment: creates intent", async () => {
      (AppointmentModel.findById as jest.Mock).mockReturnValue(
        mockChain({ status: "NO_PAYMENT", appointmentType: { id: "srv-1" }, organisationId: "org-1", companion: { parent: { id: "p-1" }, id: "c-1" } })
      );
      (ServiceModel.findById as jest.Mock).mockReturnValue(mockChain({ cost: 100 }));
      (OrganizationModel.findById as jest.Mock).mockReturnValue(mockChain({ stripeAccountId: "acct_1" }));

      const res = await StripeService.createPaymentIntentForAppointment("appt-1");
      expect(res.paymentIntentId).toBe("pi_1");
    });

    it("createPaymentIntentForInvoice: switches from LINK to INTENT if needed", async () => {
      const mockInvoice = {
        _id: "inv-1", status: "AWAITING_PAYMENT", paymentCollectionMethod: "PAYMENT_LINK", stripeCheckoutSessionId: "cs_1", totalAmount: 50, organisationId: "org-1"
      };
      (InvoiceModel.findById as jest.Mock)
        .mockReturnValueOnce(mockChain(mockInvoice))
        .mockReturnValueOnce(mockChain({ ...mockInvoice, paymentCollectionMethod: "PAYMENT_INTENT", stripeCheckoutSessionId: null }));
      (OrganizationModel.findById as jest.Mock).mockReturnValue(mockChain({ stripeAccountId: "acct_1" }));

      await StripeService.createPaymentIntentForInvoice("inv-1");

      expect(InvoiceModel.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: "inv-1" }),
        expect.anything()
      );
    });

    it("createPaymentIntentForInvoice: returns existing intent if present", async () => {
      (InvoiceModel.findById as jest.Mock).mockReturnValue(
        mockChain({ status: "PENDING", stripePaymentIntentId: "pi_existing" })
      );
      const res = await StripeService.createPaymentIntentForInvoice("inv-1");
      expect((res as any).id).toBe("pi_existing");
    });
  });

  describe("Checkout Sessions (Invoice)", () => {
    it("createCheckoutSessionForInvoice: creates session and updates invoice", async () => {
      (InvoiceModel.findById as jest.Mock).mockReturnValue(
        mockChain({
          _id: "inv-1", status: "PENDING", organisationId: "org-1", items: [{ name: "Item 1", unitPrice: 100, quantity: 1 }]
        })
      );
      (OrganizationModel.findById as jest.Mock).mockReturnValue(mockChain({ stripeAccountId: "acct_1" }));

      const res = await StripeService.createCheckoutSessionForInvoice("inv-1");

      expect(res.sessionId).toBe("cs_1");
      expect(InvoiceModel.updateOne).toHaveBeenCalledWith(
        { _id: "inv-1" },
        expect.anything()
      );
    });

    it("retrieveCheckoutSession: retrieves details", async () => {
      const res = await StripeService.retrieveCheckoutSession("cs_1");
      expect(res.status).toBe("paid");
    });
  });

  describe("Refunds", () => {
    it("refundPaymentIntent: creates refund and marks invoice", async () => {
      (InvoiceModel.findOne as jest.Mock).mockReturnValue(mockChain({ _id: "inv-1" }));
      const res = await StripeService.refundPaymentIntent("pi_1");

      expect(InvoiceService.markRefunded).toHaveBeenCalledWith("inv-1");
      expect(res.refundId).toBe("re_1");
    });
  });

  describe("Webhooks", () => {
    it("verifyWebhook: throws if signature invalid", () => {
      expect(() => StripeService.verifyWebhook(Buffer.from(""), undefined)).toThrow();
    });

    it("handleWebhookEvent: routes to correct handler (account.updated)", async () => {
      const event = { type: "account.updated", data: { object: { id: "acct_1", charges_enabled: true } } } as any;
      await StripeService.handleWebhookEvent(event);
      expect(OrgBilling.updateOne).toHaveBeenCalledWith({ connectAccountId: "acct_1" }, expect.anything());
    });

    it("handleWebhookEvent: checkout.session.completed (SUBSCRIPTION)", async () => {
      const event = { type: "checkout.session.completed", data: { object: { mode: "subscription", customer: "cus_1", subscription: "sub_1" } } } as any;
      await StripeService.handleWebhookEvent(event);
      expect(OrgBilling.updateOne).toHaveBeenCalledWith({ stripeCustomerId: "cus_1" }, expect.anything());
    });

    it("handleWebhookEvent: checkout.session.completed (INVOICE - Success)", async () => {
      const event = { type: "checkout.session.completed", data: { object: { mode: "payment", metadata: { invoiceId: "inv-1" }, id: "cs_1" } } } as any;
      (InvoiceModel.findById as jest.Mock).mockReturnValue(mockChain({
        _id: "inv-1", status: "PENDING", paymentCollectionMethod: "PAYMENT_LINK", stripeCheckoutSessionId: "cs_1", parentId: "p1"
      }));

      await StripeService.handleWebhookEvent(event);
      expect(InvoiceModel.updateOne).toHaveBeenCalled();
    });

    it("handleWebhookEvent: invoice.paid", async () => {
        const event = { type: "invoice.paid", data: { object: { lines: { data: [{ subscription: "sub_1" }] } } } } as any;
        await StripeService.handleWebhookEvent(event);
        expect(OrgBilling.updateOne).toHaveBeenCalledWith({ stripeSubscriptionId: "sub_1" }, expect.anything());
    });

    it("handleWebhookEvent: payment_intent.succeeded (Appointment)", async () => {
        const event = {
            type: "payment_intent.succeeded",
            data: { object: {
                metadata: { type: "APPOINTMENT_BOOKING", appointmentId: "appt-1" },
                latest_charge: "ch_1",
                currency: "usd",
                id: "pi_1"
            } }
        } as any;

        (AppointmentModel.findById as jest.Mock).mockReturnValue(mockChain({
            organisationId: "org-1", appointmentType: { id: "srv-1" }, companion: { parent: { id: "p-1" }, id: "c-1" }
        }));
        (ServiceModel.findById as jest.Mock).mockReturnValue(mockChain({ cost: 50, name: "Svc", description: "desc" }));
        (InvoiceModel.findOne as jest.Mock).mockReturnValue(mockChain(null));
        (InvoiceModel.create as jest.Mock).mockResolvedValue({ _id: "inv-new", id: "inv-new" });

        await StripeService.handleWebhookEvent(event);

        expect(InvoiceModel.create).toHaveBeenCalled();
        expect(AppointmentModel.updateOne).toHaveBeenCalled();
    });

    it("handleWebhookEvent: unknown type", async () => {
        const event = { type: "unknown.event", data: { object: {} } } as any;
        await StripeService.handleWebhookEvent(event);
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("Unhandled Stripe event"));
    });
  });
});