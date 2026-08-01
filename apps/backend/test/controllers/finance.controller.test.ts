import { FinanceController } from "../../src/controllers/app/finance.controller";
import { FinancePaymentService } from "../../src/services/finance/payment";
import { FinanceSubscriptionService } from "../../src/services/finance/subscription";
import { FinanceEventService } from "../../src/services/finance/events";
import { StripeController } from "../../src/controllers/web/stripe.controller";
import { InvoiceService } from "../../src/services/invoice.service";
import { AuthUserMobileService } from "../../src/services/authUserMobile.service";
import {
  FinanceDiscountSettingsError,
  FinanceDiscountSettingsService,
} from "../../src/services/finance/discount-settings";
import {
  AppointmentPrismaService,
  AppointmentPrismaServiceError,
} from "../../src/services/appointment.prisma.service";
import { StripeService } from "../../src/services/stripe.service";
import { Request, Response } from "express";

jest.mock("../../src/services/finance/payment", () => ({
  FinancePaymentService: {
    createCheckoutSessionForInvoice: jest.fn(),
    createPaymentIntentForInvoice: jest.fn(),
    recordInvoicePayment: jest.fn(),
    refundPaymentById: jest.fn(),
  },
}));

jest.mock("../../src/services/stripe.service", () => ({
  __esModule: true,
  StripeService: {
    retrievePaymentIntent: jest.fn(),
  },
}));

jest.mock("../../src/controllers/web/stripe.controller", () => ({
  StripeController: {
    webhook: jest.fn(),
  },
}));

jest.mock("../../src/services/invoice.service", () => ({
  __esModule: true,
  InvoiceService: {
    createDraftForAppointment: jest.fn(),
    listForOrganisation: jest.fn(),
    getByAppointmentId: jest.fn(),
    listForParent: jest.fn(),
    listForCompanion: jest.fn(),
    getById: jest.fn(),
    getByPaymentIntentId: jest.fn(),
    bootstrapForAppointment: jest.fn(),
    finalizeTaxForInvoice: jest.fn(),
    previewTaxForInvoice: jest.fn(),
    handleInvoiceCancellation: jest.fn(),
    addItemsToInvoice: jest.fn(),
    addChargesToAppointment: jest.fn(),
    markAppointmentReadyForBilling: jest.fn(),
    reverseAppointmentReadyForBilling: jest.fn(),
  },
  InvoiceServiceError: class InvoiceServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode = 400,
    ) {
      super(message);
      this.name = "InvoiceServiceError";
    }
  },
}));

jest.mock("../../src/services/finance/subscription", () => ({
  __esModule: true,
  FinanceSubscriptionService: {
    getCurrentSubscription: jest.fn(),
    upsertSubscription: jest.fn(),
    listUsageSnapshots: jest.fn(),
  },
}));

jest.mock("../../src/services/finance/events", () => ({
  __esModule: true,
  FinanceEventService: {
    recordEvent: jest.fn(),
  },
  resolveActorDisplayName: jest.fn(),
}));

jest.mock("../../src/services/authUserMobile.service", () => ({
  __esModule: true,
  AuthUserMobileService: {
    getByProviderUserId: jest.fn(),
  },
}));

jest.mock("../../src/services/finance/discount-settings", () => ({
  __esModule: true,
  FinanceDiscountSettingsError: class FinanceDiscountSettingsError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
      this.name = "FinanceDiscountSettingsError";
    }
  },
  FinanceDiscountSettingsService: {
    getForOrganisation: jest.fn(),
    updateForOrganisation: jest.fn(),
    getMaxOverallDiscountPercent: jest.fn(),
  },
}));

jest.mock("../../src/services/appointment.prisma.service", () => ({
  __esModule: true,
  AppointmentPrismaService: {
    getById: jest.fn(),
  },
  AppointmentPrismaServiceError: class AppointmentPrismaServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode = 400,
    ) {
      super(message);
      this.name = "AppointmentPrismaServiceError";
    }
  },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

describe("FinanceController", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("discount settings", () => {
    const buildRes = () =>
      ({
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }) as unknown as Response;

    it("returns the organisation's configured cap", async () => {
      (
        FinanceDiscountSettingsService.getForOrganisation as jest.Mock
      ).mockResolvedValueOnce({
        organisationId: "org_1",
        maxOverallDiscountPercent: 20,
      });

      const req = { params: { organisationId: "org_1" } } as unknown as Request;
      const res = buildRes();

      await FinanceController.getDiscountSettings(req, res);

      expect(
        FinanceDiscountSettingsService.getForOrganisation,
      ).toHaveBeenCalledWith("org_1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        data: { organisationId: "org_1", maxOverallDiscountPercent: 20 },
        meta: null,
        error: null,
      });
    });

    it("surfaces a 404 when the organisation does not exist", async () => {
      (
        FinanceDiscountSettingsService.getForOrganisation as jest.Mock
      ).mockRejectedValueOnce(
        new FinanceDiscountSettingsError("Organisation not found.", 404),
      );

      const req = { params: { organisationId: "org_x" } } as unknown as Request;
      const res = buildRes();

      await FinanceController.getDiscountSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Organisation not found.",
      });
    });

    it.each([0, 50, 100])("accepts an in-range cap of %s", async (percent) => {
      (
        FinanceDiscountSettingsService.updateForOrganisation as jest.Mock
      ).mockResolvedValueOnce({
        organisationId: "org_1",
        maxOverallDiscountPercent: percent,
      });

      const req = {
        params: { organisationId: "org_1" },
        body: { maxOverallDiscountPercent: percent },
      } as unknown as Request;
      const res = buildRes();

      await FinanceController.updateDiscountSettings(req, res);

      expect(
        FinanceDiscountSettingsService.updateForOrganisation,
      ).toHaveBeenCalledWith("org_1", { maxOverallDiscountPercent: percent });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("accepts null to clear the cap", async () => {
      (
        FinanceDiscountSettingsService.updateForOrganisation as jest.Mock
      ).mockResolvedValueOnce({
        organisationId: "org_1",
        maxOverallDiscountPercent: null,
      });

      const req = {
        params: { organisationId: "org_1" },
        body: { maxOverallDiscountPercent: null },
      } as unknown as Request;
      const res = buildRes();

      await FinanceController.updateDiscountSettings(req, res);

      expect(
        FinanceDiscountSettingsService.updateForOrganisation,
      ).toHaveBeenCalledWith("org_1", { maxOverallDiscountPercent: null });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it.each([
      ["above the range", 101],
      ["below the range", -1],
      ["a non-numeric string", "50"],
      ["a boolean", true],
      ["NaN", Number.NaN],
    ])("rejects %s", async (_label, value) => {
      const req = {
        params: { organisationId: "org_1" },
        body: { maxOverallDiscountPercent: value },
      } as unknown as Request;
      const res = buildRes();

      await FinanceController.updateDiscountSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid request body",
      });
      expect(
        FinanceDiscountSettingsService.updateForOrganisation,
      ).not.toHaveBeenCalled();
    });

    it("rejects a missing organisation id", async () => {
      const req = {
        params: {},
        body: { maxOverallDiscountPercent: 10 },
      } as unknown as Request;
      const res = buildRes();

      await FinanceController.updateDiscountSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Organisation Id is required",
      });
    });
  });

  it("creates a provider-aware payment session for Stripe", async () => {
    (
      FinancePaymentService.createCheckoutSessionForInvoice as jest.Mock
    ).mockResolvedValueOnce({
      sessionId: "cs_1",
      url: "https://checkout",
      paymentAttemptId: "pa_1",
    });

    const req = {
      params: { invoiceId: "inv_1" },
      body: { provider: "stripe" },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.createInvoicePaymentSession(req, res);

    expect(
      FinancePaymentService.createCheckoutSessionForInvoice,
    ).toHaveBeenCalledWith("inv_1", "STRIPE");
  });

  it("rejects unsupported payment providers", async () => {
    const req = {
      params: { invoiceId: "inv_1" },
      body: { provider: "adyen" },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.createInvoicePaymentSession(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Unsupported payment provider",
    });
    expect(
      FinancePaymentService.createCheckoutSessionForInvoice,
    ).not.toHaveBeenCalled();
  });

  it("creates a mobile payment intent session for Stripe invoices", async () => {
    (
      FinancePaymentService.createPaymentIntentForInvoice as jest.Mock
    ).mockResolvedValueOnce({
      paymentIntentId: "pi_1",
      clientSecret: "secret_1",
      connectedAccountId: "acct_1",
      amount: 42,
      currency: "usd",
    });

    (
      AuthUserMobileService.getByProviderUserId as jest.Mock
    ).mockResolvedValueOnce({ parentId: "parent_1" });

    const req = {
      params: { invoiceId: "inv_1" },
      userId: "mobile_user_1",
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.createMobileInvoicePaymentSession(req, res);

    expect(
      FinancePaymentService.createPaymentIntentForInvoice,
    ).toHaveBeenCalledWith(
      "inv_1",
      { parentId: "parent_1" },
      {
        collectionMode: "DEPOSIT_THEN_SETTLE",
        settlementChannel: "DEPOSIT",
      },
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      data: {
        paymentIntentId: "pi_1",
        clientSecret: "secret_1",
        connectedAccountId: "acct_1",
        amount: 42,
        currency: "usd",
      },
      meta: null,
      error: null,
    });
  });

  it("returns 400 when the mobile invoice payment session is missing an invoice id", async () => {
    const req = {
      params: {},
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.createMobileInvoicePaymentSession(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invoice Id is required",
    });
    expect(
      FinancePaymentService.createPaymentIntentForInvoice,
    ).not.toHaveBeenCalled();
  });

  it("delegates stripe webhooks to the stripe controller", async () => {
    const req = {
      params: { provider: "stripe" },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.webhook(req, res);

    expect(StripeController.webhook).toHaveBeenCalledWith(req, res);
  });

  it("rejects unsupported webhook providers", async () => {
    const req = {
      params: { provider: "adyen" },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.webhook(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Unsupported provider",
    });
    expect(StripeController.webhook).not.toHaveBeenCalled();
  });

  it("returns appointment invoices in finance envelope format", async () => {
    (InvoiceService.getByAppointmentId as jest.Mock).mockResolvedValueOnce([
      { id: "inv_1" },
    ]);

    const req = {
      params: { appointmentId: "appt_1" },
      organisationId: "org_1",
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.listInvoicesForAppointment(req, res);

    expect(InvoiceService.getByAppointmentId).toHaveBeenCalledWith("appt_1", {
      organisationId: "org_1",
      parentId: null,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: [{ id: "inv_1" }],
      meta: null,
      error: null,
    });
  });

  it("rejects mobile parent invoice access when the parent does not match the linked user", async () => {
    (
      AuthUserMobileService.getByProviderUserId as jest.Mock
    ).mockResolvedValueOnce({
      parentId: "parent_2",
    });

    const req = {
      params: { parentId: "parent_1" },
      userId: "mobile_user_1",
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.listInvoicesForParent(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Cannot access invoices for another parent",
    });
  });

  it("allows mobile parent invoice access for the linked user", async () => {
    (
      AuthUserMobileService.getByProviderUserId as jest.Mock
    ).mockResolvedValueOnce({
      parentId: "parent_1",
    });
    (InvoiceService.listForParent as jest.Mock).mockResolvedValueOnce([
      { id: "inv_parent" },
    ]);

    const req = {
      params: { parentId: "parent_1" },
      userId: "mobile_user_1",
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.listInvoicesForParent(req, res);

    expect(InvoiceService.listForParent).toHaveBeenCalledWith("parent_1", null);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: [{ id: "inv_parent" }],
      meta: null,
      error: null,
    });
  });

  it("creates a draft invoice from appointment payload", async () => {
    (
      InvoiceService.createDraftForAppointment as jest.Mock
    ).mockResolvedValueOnce({
      id: "inv_create",
    });

    const req = {
      body: {
        appointmentId: "appt_1",
        parentId: "parent_1",
        patientId: "patient_1",
        organisationId: "org_1",
        paymentCollectionMethod: "PAYMENT_LINK",
        items: [
          {
            name: "Consult",
            quantity: 1,
            unitPrice: 100,
            total: 100,
          },
        ],
      },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.createInvoice(req, res);

    expect(InvoiceService.createDraftForAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: "appt_1",
        parentId: "parent_1",
        patientId: "patient_1",
        organisationId: "org_1",
        paymentCollectionMethod: "PAYMENT_LINK",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      data: { id: "inv_create" },
      meta: null,
      error: null,
    });
  });

  it("lists invoices using organisation filters", async () => {
    (InvoiceService.listForOrganisation as jest.Mock).mockResolvedValueOnce([
      { id: "inv_org" },
    ]);

    const req = {
      query: { organisationId: "org_1" },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.listInvoices(req, res);

    expect(InvoiceService.listForOrganisation).toHaveBeenCalledWith("org_1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("lists invoices by appointment when both appointment and organisation filters are present", async () => {
    (InvoiceService.getByAppointmentId as jest.Mock).mockResolvedValueOnce([
      { id: "inv_appt" },
    ]);

    const req = {
      query: {
        organisationId: "org_1",
        appointmentId: "appt_1",
      },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.listInvoices(req, res);

    expect(InvoiceService.getByAppointmentId).toHaveBeenCalledWith("appt_1", {
      organisationId: "org_1",
    });
    expect(InvoiceService.listForOrganisation).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: [{ id: "inv_appt" }],
      meta: null,
      error: null,
    });
  });

  it("lists organisation invoices through the finance alias", async () => {
    (InvoiceService.listForOrganisation as jest.Mock).mockResolvedValueOnce([
      { id: "inv_org" },
    ]);

    const req = {
      params: { organisationId: "org_1" },
      organisationId: "org_1",
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.listInvoicesForOrganisation(req, res);

    expect(InvoiceService.listForOrganisation).toHaveBeenCalledWith("org_1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: [{ id: "inv_org" }],
      meta: null,
      error: null,
    });
  });

  it("rejects list requests without a filter", async () => {
    const req = {
      query: {},
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.listInvoices(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("adds invoice lines to an existing invoice", async () => {
    (InvoiceService.addItemsToInvoice as jest.Mock).mockResolvedValueOnce({
      id: "inv_line",
    });

    const req = {
      params: { invoiceId: "inv_line" },
      body: {
        items: [
          {
            name: "Medication",
            quantity: 1,
            unitPrice: 20,
            total: 20,
          },
        ],
      },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.addInvoiceItems(req, res);

    expect(InvoiceService.addItemsToInvoice).toHaveBeenCalledWith("inv_line", [
      {
        name: "Medication",
        quantity: 1,
        unitPrice: 20,
        total: 20,
      },
    ]);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("bootstraps an appointment invoice for mobile seed flows", async () => {
    (
      AuthUserMobileService.getByProviderUserId as jest.Mock
    ).mockResolvedValueOnce({ parentId: "parent_1" });
    (AppointmentPrismaService.getById as jest.Mock).mockResolvedValueOnce({
      id: "appt_1",
    });
    (InvoiceService.bootstrapForAppointment as jest.Mock).mockResolvedValueOnce(
      {
        id: "inv_seed",
      },
    );

    const req = {
      params: { appointmentId: "appt_1" },
      userId: "mobile_user_1",
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.bootstrapInvoiceForAppointment(req, res);

    expect(AppointmentPrismaService.getById).toHaveBeenCalledWith("appt_1", {
      parentId: "parent_1",
    });
    expect(InvoiceService.bootstrapForAppointment).toHaveBeenCalledWith(
      "appt_1",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: { id: "inv_seed" },
      meta: null,
      error: null,
    });
  });

  it("does not seed an invoice for an appointment the mobile caller is not linked to", async () => {
    (
      AuthUserMobileService.getByProviderUserId as jest.Mock
    ).mockResolvedValueOnce({ parentId: "parent_1" });
    (AppointmentPrismaService.getById as jest.Mock).mockRejectedValueOnce(
      new AppointmentPrismaServiceError("Appointment not found", 404),
    );

    const req = {
      params: { appointmentId: "appt_of_another_parent" },
      userId: "mobile_user_1",
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.bootstrapInvoiceForAppointment(req, res);

    expect(InvoiceService.bootstrapForAppointment).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("refuses to seed an invoice when the caller resolves to no parent", async () => {
    (
      AuthUserMobileService.getByProviderUserId as jest.Mock
    ).mockResolvedValueOnce(null);

    const req = {
      params: { appointmentId: "appt_1" },
      userId: "mobile_user_1",
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.bootstrapInvoiceForAppointment(req, res);

    expect(AppointmentPrismaService.getById).not.toHaveBeenCalled();
    expect(InvoiceService.bootstrapForAppointment).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("finalizes invoice tax snapshots", async () => {
    (InvoiceService.finalizeTaxForInvoice as jest.Mock).mockResolvedValueOnce({
      id: "inv_final",
      finalizedAt: "now",
    });

    const req = {
      params: { invoiceId: "inv_final" },
      body: { taxProvider: "stripe" },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.finalizeInvoice(req, res);

    expect(InvoiceService.finalizeTaxForInvoice).toHaveBeenCalledWith(
      "inv_final",
      "stripe",
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("records manual invoice payments", async () => {
    (
      FinancePaymentService.recordInvoicePayment as jest.Mock
    ).mockResolvedValueOnce({
      payment: { id: "pay_1", status: "SUCCEEDED" },
      appliedAmount: 25,
      balanceAfterPayment: 75,
    });

    const req = {
      params: { invoiceId: "inv_pay" },
      body: {
        provider: "MANUAL",
        settlementChannel: "CASH",
        amount: 25,
        currency: "usd",
        reference: "receipt-1",
        receivedAt: "2026-06-18T12:00:00.000Z",
      },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.recordInvoicePayment(req, res);

    expect(FinancePaymentService.recordInvoicePayment).toHaveBeenCalledWith(
      "inv_pay",
      expect.objectContaining({
        provider: "MANUAL",
        settlementChannel: "CASH",
        amount: 25,
        currency: "usd",
        reference: "receipt-1",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      data: {
        paymentId: "pay_1",
        status: "SUCCEEDED",
        amount: 25,
        balanceAfterPayment: 75,
      },
      meta: null,
      error: null,
    });
  });

  it("returns the current subscription summary", async () => {
    (
      FinanceSubscriptionService.getCurrentSubscription as jest.Mock
    ).mockResolvedValueOnce({
      organisationId: "org_1",
      providerLink: { provider: "STRIPE" },
      entitlement: { code: "BUSINESS_PLAN" },
    });

    const req = {
      query: { organisationId: "org_1" },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.getCurrentSubscription(req, res);

    expect(
      FinanceSubscriptionService.getCurrentSubscription,
    ).toHaveBeenCalledWith("org_1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: {
        organisationId: "org_1",
        providerLink: { provider: "STRIPE" },
        entitlement: { code: "BUSINESS_PLAN" },
      },
      meta: null,
      error: null,
    });
  });

  it("upserts a subscription from the finance api", async () => {
    (
      FinanceSubscriptionService.upsertSubscription as jest.Mock
    ).mockResolvedValueOnce({
      organisationId: "org_1",
      providerLink: { provider: "STRIPE" },
      entitlement: { code: "BUSINESS_PLAN" },
    });

    const req = {
      body: {
        organisationId: "org_1",
        planCode: "business",
        provider: "stripe",
        providerSubscriptionId: "sub_1",
        quantity: 3,
      },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.upsertSubscription(req, res);

    expect(FinanceSubscriptionService.upsertSubscription).toHaveBeenCalledWith({
      orgId: "org_1",
      planCode: "business",
      provider: "stripe",
      providerSubscriptionId: "sub_1",
      quantity: 3,
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("returns usage snapshots with query filters", async () => {
    (
      FinanceSubscriptionService.listUsageSnapshots as jest.Mock
    ).mockResolvedValueOnce([{ id: "snap_1" }]);

    const req = {
      query: {
        organisationId: "org_1",
        subscriptionId: "sub_1",
        featureKey: "appointments",
      },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.getUsageSnapshots(req, res);

    expect(FinanceSubscriptionService.listUsageSnapshots).toHaveBeenCalledWith(
      "org_1",
      {
        subscriptionId: "sub_1",
        featureKey: "appointments",
      },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("marks an appointment ready for billing from the finance route", async () => {
    (
      InvoiceService.markAppointmentReadyForBilling as jest.Mock
    ).mockResolvedValueOnce({
      id: "inv_ready",
      visitBillingStage: "READY_FOR_BILLING",
      billingCollectionMode: "PAY_AT_VISIT_END",
    });
    (FinanceEventService.recordEvent as jest.Mock).mockResolvedValueOnce({});

    const req = {
      params: { appointmentId: "appt_1" },
      body: { visitId: "visit_1", notes: "Ready" },
      organisationId: "org_1",
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.markAppointmentReadyForBilling(req, res);

    expect(InvoiceService.markAppointmentReadyForBilling).toHaveBeenCalledWith(
      "appt_1",
      { organisationId: "org_1", actorUserId: undefined },
    );
    expect(FinanceEventService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org_1",
        eventType: "APPOINTMENT_READY_FOR_BILLING",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("reverses an appointment ready-for-billing state from the finance route", async () => {
    (
      InvoiceService.reverseAppointmentReadyForBilling as jest.Mock
    ).mockResolvedValueOnce({
      id: "inv_ready",
      visitBillingStage: "DRAFT",
      billingCollectionMode: "PAY_AT_VISIT_END",
    });
    (FinanceEventService.recordEvent as jest.Mock).mockResolvedValueOnce({});

    const req = {
      params: { appointmentId: "appt_1" },
      organisationId: "org_1",
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.reverseAppointmentReadyForBilling(req, res);

    expect(
      InvoiceService.reverseAppointmentReadyForBilling,
    ).toHaveBeenCalledWith("appt_1", {
      organisationId: "org_1",
      actorUserId: undefined,
    });
    expect(FinanceEventService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org_1",
        eventType: "APPOINTMENT_READY_FOR_BILLING_REVERSED",
        payload: expect.objectContaining({
          invoiceId: "inv_ready",
          billingState: "DRAFT",
        }),
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          appointmentId: "appt_1",
          billingState: "DRAFT",
          invoiceId: "inv_ready",
          collectionMode: "PAY_AT_VISIT_END",
        }),
      }),
    );
  });

  it("records a visit milestone and auto-readies billing when requested", async () => {
    (
      InvoiceService.markAppointmentReadyForBilling as jest.Mock
    ).mockResolvedValueOnce({
      id: "inv_visit",
      visitBillingStage: "READY_FOR_BILLING",
      billingCollectionMode: "PAY_AT_VISIT_END",
    });
    (FinanceEventService.recordEvent as jest.Mock).mockResolvedValueOnce({});

    const req = {
      params: { visitId: "visit_1" },
      body: {
        milestone: "READY_FOR_BILLING",
        organisationId: "org_1",
        appointmentId: "appt_1",
        metadata: { reason: "done" },
      },
      organisationId: "org_1",
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.recordVisitMilestone(req, res);

    expect(InvoiceService.markAppointmentReadyForBilling).toHaveBeenCalledWith(
      "appt_1",
      { organisationId: "org_1" },
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          visitId: "visit_1",
          milestone: "READY_FOR_BILLING",
          billingState: "READY_FOR_BILLING",
        }),
      }),
    );
  });

  it("refunds payment records", async () => {
    (
      FinancePaymentService.refundPaymentById as jest.Mock
    ).mockResolvedValueOnce({
      refund: {
        refundId: "refund_1",
        providerRefundId: "re_1",
        status: "SUCCEEDED",
        amountRefunded: 20,
        paymentId: "pay_1",
      },
    });

    const req = {
      params: { paymentId: "pay_1" },
      body: { amount: 20, reason: "SERVICE_NOT_RENDERED" },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.refundPayment(req, res);

    expect(FinancePaymentService.refundPaymentById).toHaveBeenCalledWith(
      "pay_1",
      {
        amount: 20,
        reason: "SERVICE_NOT_RENDERED",
      },
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      data: {
        refundId: "refund_1",
        providerRefundId: "re_1",
        status: "SUCCEEDED",
        amountRefunded: 20,
        paymentId: "pay_1",
      },
      meta: null,
      error: null,
    });
  });

  it("previews invoice tax snapshots with provider awareness", async () => {
    (InvoiceService.previewTaxForInvoice as jest.Mock).mockResolvedValueOnce({
      invoice: { id: "inv_preview" },
      taxProvider: "STRIPE",
      taxSnapshot: { provider: "STRIPE" },
      taxTotal: 18,
      totalAmount: 118,
    });

    const req = {
      params: { invoiceId: "inv_preview" },
      body: { taxProvider: "stripe" },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.previewInvoiceTax(req, res);

    expect(InvoiceService.previewTaxForInvoice).toHaveBeenCalledWith(
      "inv_preview",
      "stripe",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: {
        invoice: { id: "inv_preview" },
        taxProvider: "STRIPE",
        taxSnapshot: { provider: "STRIPE" },
        taxTotal: 18,
        totalAmount: 118,
      },
      meta: null,
      error: null,
    });
  });

  it("voids invoices and returns the resulting action", async () => {
    (
      InvoiceService.handleInvoiceCancellation as jest.Mock
    ).mockResolvedValueOnce({ action: "CANCELLED_UNPAID" });
    (InvoiceService.getById as jest.Mock).mockResolvedValueOnce({
      invoice: { id: "inv_void" },
    });

    const req = {
      params: { invoiceId: "inv_void" },
      body: { reason: "entered in error" },
      organisationId: "org_1",
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.voidInvoice(req, res);

    expect(InvoiceService.handleInvoiceCancellation).toHaveBeenCalledWith(
      "inv_void",
      "entered in error",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: {
        action: { action: "CANCELLED_UNPAID" },
        invoice: { invoice: { id: "inv_void" } },
      },
      meta: null,
      error: null,
    });
  });

  it("supplements invoices using the appointment context of the original invoice", async () => {
    (InvoiceService.getById as jest.Mock).mockResolvedValueOnce({
      invoice: { appointmentId: "appt_1" },
    });
    (InvoiceService.addChargesToAppointment as jest.Mock).mockResolvedValueOnce(
      {
        id: "inv_supplement",
      },
    );

    const req = {
      params: { invoiceId: "inv_source" },
      body: {
        items: [
          {
            name: "Medication",
            quantity: 1,
            unitPrice: 20,
            total: 20,
          },
        ],
      },
      organisationId: "org_1",
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.supplementInvoice(req, res);

    expect(InvoiceService.addChargesToAppointment).toHaveBeenCalledWith(
      "appt_1",
      [
        {
          name: "Medication",
          quantity: 1,
          unitPrice: 20,
          total: 20,
        },
      ],
      "org_1",
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
  it("refuses a mobile payment session when the session is not linked to a parent", async () => {
    (
      AuthUserMobileService.getByProviderUserId as jest.Mock
    ).mockResolvedValueOnce(null);

    const req = {
      params: { invoiceId: "inv_1" },
      userId: "mobile_user_unlinked",
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.createMobileInvoicePaymentSession(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(
      FinancePaymentService.createPaymentIntentForInvoice,
    ).not.toHaveBeenCalled();
  });

  it("passes the caller's own parent id when creating a mobile payment session", async () => {
    // The invoice id is caller-controlled, so the parent binding is what stops a
    // mobile user paying against (and reading the secret of) another parent's invoice.
    (
      AuthUserMobileService.getByProviderUserId as jest.Mock
    ).mockResolvedValueOnce({ parentId: "parent_self" });
    (
      FinancePaymentService.createPaymentIntentForInvoice as jest.Mock
    ).mockResolvedValueOnce({ paymentIntentId: "pi_1" });

    const req = {
      params: { invoiceId: "inv_of_another_parent" },
      userId: "mobile_user_1",
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.createMobileInvoicePaymentSession(req, res);

    expect(
      FinancePaymentService.createPaymentIntentForInvoice,
    ).toHaveBeenCalledWith(
      "inv_of_another_parent",
      { parentId: "parent_self" },
      expect.anything(),
    );
  });

  it("scopes a mobile payment-intent read to the caller's parent", async () => {
    (
      AuthUserMobileService.getByProviderUserId as jest.Mock
    ).mockResolvedValueOnce({ parentId: "parent_self" });
    (StripeService.retrievePaymentIntent as jest.Mock).mockResolvedValueOnce({
      id: "pi_1",
    });

    const req = {
      params: { paymentIntentId: "pi_1" },
      userId: "mobile_user_1",
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.retrievePaymentIntent(req, res);

    expect(StripeService.retrievePaymentIntent).toHaveBeenCalledWith("pi_1", {
      organisationId: null,
      parentId: "parent_self",
    });
  });

  it("refuses a mobile invoice read when the session is not linked to a parent", async () => {
    (
      AuthUserMobileService.getByProviderUserId as jest.Mock
    ).mockResolvedValueOnce(null);

    const req = {
      params: { invoiceId: "inv_1" },
      userId: "mobile_user_unlinked",
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.getInvoiceById(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(InvoiceService.getById).not.toHaveBeenCalled();
  });

  it("rejects a visit milestone whose body organisation is not the authorized one", async () => {
    const req = {
      params: { visitId: "visit_1" },
      body: {
        milestone: "READY_FOR_BILLING",
        organisationId: "org_victim",
        appointmentId: "appt_1",
      },
      organisationId: "org_attacker",
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.recordVisitMilestone(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(
      InvoiceService.markAppointmentReadyForBilling,
    ).not.toHaveBeenCalled();
  });
});
