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
import { ProviderReceiptService } from "../../src/services/finance/provider-receipt";
import { ProviderReceiptAuditService } from "../../src/services/finance/provider-receipt-audit";
import { ClientAccountService } from "../../src/services/finance/client-account";
import { encodeKeysetCursor } from "../../src/services/shared/pagination";
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

jest.mock("../../src/services/finance/provider-receipt", () => ({
  __esModule: true,
  ProviderReceiptService: {
    listForReconciliation: jest.fn(),
    allocate: jest.fn(),
  },
  // The real list, not a stand-in: the query schema is built from it at module
  // scope, so a shortened one here would let a filter pass in the test that
  // the running controller rejects.
  RECONCILIATION_STATUSES: [
    "UNATTRIBUTED",
    "UNALLOCATED",
    "ALLOCATED",
    "PARTIALLY_REFUNDED",
    "REFUNDED",
  ],
}));

jest.mock("../../src/services/finance/provider-receipt-audit", () => ({
  __esModule: true,
  ProviderReceiptAuditService: {
    auditHistoricalMismatches: jest.fn(),
  },
}));

jest.mock("../../src/services/finance/client-account", () => ({
  __esModule: true,
  ClientAccountService: {
    getAccountCredit: jest.fn(),
    proposeAllocation: jest.fn(),
    applyAllocation: jest.fn(),
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
    ).toHaveBeenCalledWith("inv_1", "STRIPE", null);
  });

  it("forwards a requested deposit amount to the payment service", async () => {
    // Without this the session is built for the full outstanding balance, so a
    // deposit link bills the whole invoice.
    (
      FinancePaymentService.createCheckoutSessionForInvoice as jest.Mock
    ).mockResolvedValueOnce({
      sessionId: "cs_2",
      url: "https://checkout",
      paymentAttemptId: "pa_2",
    });

    const req = {
      params: { invoiceId: "inv_1" },
      body: { provider: "stripe", depositAmount: 25 },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await FinanceController.createInvoicePaymentSession(req, res);

    expect(
      FinancePaymentService.createCheckoutSessionForInvoice,
    ).toHaveBeenCalledWith("inv_1", "STRIPE", 25);
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
      organisationId: "org_1",
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
      organisationId: "org_1",
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
      organisationId: "org_1",
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
      organisationId: "org_1",
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

describe("FinanceController.listProviderReceipts", () => {
  const buildRes = () =>
    ({
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }) as unknown as Response;

  const buildReq = (overrides: Record<string, unknown> = {}) =>
    ({
      params: { organisationId: "org_1" },
      query: {},
      organisationId: "org_1",
      ...overrides,
    }) as unknown as Request;

  const emptyPage = {
    receipts: [],
    nextCursor: null,
    hasMore: false,
    limit: 50,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    (
      ProviderReceiptService.listForReconciliation as jest.Mock
    ).mockResolvedValue(emptyPage);
  });

  it("scopes the queue to the authorized organisation, not the path", async () => {
    // The path segment is caller-controlled. Taking the organisation from it
    // would let anyone with the permission in their own org read another
    // tenant's captured money.
    const req = buildReq({
      params: { organisationId: "org_victim" },
      organisationId: "org_attacker",
    });
    const res = buildRes();

    await FinanceController.listProviderReceipts(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(ProviderReceiptService.listForReconciliation).not.toHaveBeenCalled();
  });

  it("returns the page with the fields that say it is not silently truncated", async () => {
    (
      ProviderReceiptService.listForReconciliation as jest.Mock
    ).mockResolvedValue({
      receipts: [{ id: "receipt-1" }],
      nextCursor: "cursor-2",
      hasMore: true,
      limit: 50,
    });
    const res = buildRes();

    await FinanceController.listProviderReceipts(buildReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: [{ id: "receipt-1" }],
      meta: { nextCursor: "cursor-2", hasMore: true, limit: 50 },
      error: null,
    });
  });

  it("passes a single status through as a one-element filter", async () => {
    const res = buildRes();

    await FinanceController.listProviderReceipts(
      buildReq({ query: { status: "UNATTRIBUTED" } }),
      res,
    );

    expect(ProviderReceiptService.listForReconciliation).toHaveBeenCalledWith(
      expect.objectContaining({ statuses: ["UNATTRIBUTED"] }),
    );
  });

  it("passes a repeated status through as the set the caller asked for", async () => {
    const res = buildRes();

    await FinanceController.listProviderReceipts(
      buildReq({ query: { status: ["UNATTRIBUTED", "PARTIALLY_REFUNDED"] } }),
      res,
    );

    expect(ProviderReceiptService.listForReconciliation).toHaveBeenCalledWith(
      expect.objectContaining({
        statuses: ["UNATTRIBUTED", "PARTIALLY_REFUNDED"],
      }),
    );
  });

  it("rejects a state that is not one of the model's", async () => {
    const res = buildRes();

    await FinanceController.listProviderReceipts(
      buildReq({ query: { status: "SETTLED" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ProviderReceiptService.listForReconciliation).not.toHaveBeenCalled();
  });

  it("requires the capture window to state its offset", async () => {
    // A bare date read at the operator's local midnight and applied against a
    // UTC capturedAt moves the boundary by hours, which silently includes or
    // drops a day's money from a reconciliation.
    const res = buildRes();

    await FinanceController.listProviderReceipts(
      buildReq({ query: { capturedFrom: "2026-09-01" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ProviderReceiptService.listForReconciliation).not.toHaveBeenCalled();
  });

  it("turns an offset-bearing window into the instants the service filters on", async () => {
    const res = buildRes();

    await FinanceController.listProviderReceipts(
      buildReq({
        query: {
          capturedFrom: "2026-09-01T00:00:00.000Z",
          capturedTo: "2026-09-30T23:59:59.000Z",
        },
      }),
      res,
    );

    expect(ProviderReceiptService.listForReconciliation).toHaveBeenCalledWith(
      expect.objectContaining({
        capturedFrom: new Date("2026-09-01T00:00:00.000Z"),
        capturedTo: new Date("2026-09-30T23:59:59.000Z"),
      }),
    );
  });

  it("answers 400 for a malformed cursor rather than letting the query throw", async () => {
    // Inferring "bad cursor" from a thrown error would report a database
    // outage as the caller's fault. Checking the shape up front is what keeps
    // every failure from the query itself honestly a 500.
    const res = buildRes();

    await FinanceController.listProviderReceipts(
      buildReq({ query: { cursor: "not-a-cursor" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ProviderReceiptService.listForReconciliation).not.toHaveBeenCalled();
  });

  it("carries a usable cursor through to the service", async () => {
    const cursor = {
      createdAt: new Date("2026-09-18T10:00:01.000Z"),
      id: "11111111-1111-4111-8111-111111111111",
    };
    const res = buildRes();

    await FinanceController.listProviderReceipts(
      buildReq({ query: { cursor: encodeKeysetCursor(cursor) } }),
      res,
    );

    expect(ProviderReceiptService.listForReconciliation).toHaveBeenCalledWith(
      expect.objectContaining({ cursor }),
    );
  });

  it("does not report a service failure as the caller's mistake", async () => {
    (
      ProviderReceiptService.listForReconciliation as jest.Mock
    ).mockRejectedValue(new Error("connection reset"));
    const res = buildRes();

    await FinanceController.listProviderReceipts(buildReq(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Internal server error",
    });
  });
});

describe("FinanceController.auditProviderReceipts", () => {
  const buildRes = () =>
    ({
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }) as unknown as Response;

  const buildReq = (overrides: Record<string, unknown> = {}) =>
    ({
      params: { organisationId: "org_1" },
      query: {},
      organisationId: "org_1",
      ...overrides,
    }) as unknown as Request;

  const cleanWindow = {
    mismatches: [],
    examined: 0,
    matched: 0,
    nextCursor: null,
    hasMore: false,
    limit: 100,
  };

  const auditMock = () =>
    ProviderReceiptAuditService.auditHistoricalMismatches as jest.Mock;

  beforeEach(() => {
    jest.resetAllMocks();
    auditMock().mockResolvedValue(cleanWindow);
  });

  it("scopes the audit to the authorized organisation, not the path", async () => {
    const res = buildRes();

    await FinanceController.auditProviderReceipts(
      buildReq({
        params: { organisationId: "org_victim" },
        organisationId: "org_attacker",
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(auditMock()).not.toHaveBeenCalled();
  });

  it("returns findings with the examined window coverage", async () => {
    auditMock().mockResolvedValue({
      mismatches: [{ kind: "NOT_JOURNALLED", paymentId: "payment-1" }],
      examined: 100,
      matched: 99,
      nextCursor: "cursor-2",
      hasMore: true,
      limit: 100,
    });
    const res = buildRes();

    await FinanceController.auditProviderReceipts(buildReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: [{ kind: "NOT_JOURNALLED", paymentId: "payment-1" }],
      meta: {
        examined: 100,
        matched: 99,
        nextCursor: "cursor-2",
        hasMore: true,
        limit: 100,
      },
      error: null,
    });
  });

  it("requires the audit window to state its offset", async () => {
    const res = buildRes();

    await FinanceController.auditProviderReceipts(
      buildReq({ query: { recordedFrom: "2026-09-01" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(auditMock()).not.toHaveBeenCalled();
  });

  it("turns an offset-bearing window into service instants", async () => {
    const res = buildRes();

    await FinanceController.auditProviderReceipts(
      buildReq({
        query: {
          recordedFrom: "2026-09-01T00:00:00.000Z",
          recordedTo: "2026-09-30T23:59:59.000Z",
        },
      }),
      res,
    );

    expect(auditMock()).toHaveBeenCalledWith(
      expect.objectContaining({
        recordedFrom: new Date("2026-09-01T00:00:00.000Z"),
        recordedTo: new Date("2026-09-30T23:59:59.000Z"),
      }),
    );
  });

  it("answers 400 for a malformed cursor", async () => {
    const res = buildRes();

    await FinanceController.auditProviderReceipts(
      buildReq({ query: { cursor: "not-a-cursor" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(auditMock()).not.toHaveBeenCalled();
  });

  it("carries a usable cursor through to the service", async () => {
    const cursor = {
      createdAt: new Date("2026-09-18T10:00:01.000Z"),
      id: "11111111-1111-4111-8111-111111111111",
    };
    const res = buildRes();

    await FinanceController.auditProviderReceipts(
      buildReq({ query: { cursor: encodeKeysetCursor(cursor) } }),
      res,
    );

    expect(auditMock()).toHaveBeenCalledWith(
      expect.objectContaining({ cursor }),
    );
  });

  it("does not report a service failure as the caller's mistake", async () => {
    auditMock().mockRejectedValue(new Error("connection reset"));
    const res = buildRes();

    await FinanceController.auditProviderReceipts(buildReq(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });
});

describe("FinanceController.allocateProviderReceipt", () => {
  const RECEIPT_ID = "11111111-1111-4111-8111-111111111111";
  const INVOICE_ID = "22222222-2222-4222-8222-222222222222";
  const OTHER_INVOICE_ID = "33333333-3333-4333-8333-333333333333";

  const buildRes = () =>
    ({
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }) as unknown as Response;

  const buildReq = (overrides: Record<string, unknown> = {}) =>
    ({
      params: { organisationId: "org_1", receiptId: RECEIPT_ID },
      organisationId: "org_1",
      userId: "user_1",
      body: {
        expectedVersion: 3,
        idempotencyKey: "key-1",
        allocations: [{ invoiceId: INVOICE_ID, amount: 25 }],
      },
      ...overrides,
    }) as unknown as Request;

  const applied = {
    outcome: "APPLIED" as const,
    receipt: { id: RECEIPT_ID, status: "ALLOCATED" },
    remainingAmount: 0,
    allocations: [{ invoiceId: INVOICE_ID, amount: 25, paymentId: "pay-1" }],
  };

  beforeEach(() => {
    jest.resetAllMocks();
    (ProviderReceiptService.allocate as jest.Mock).mockResolvedValue(applied);
  });

  it("scopes the allocation to the authorized organisation, not the path", async () => {
    // Same hazard as the queue, with money attached: taking the organisation
    // from the path would let a caller apply another tenant's capture.
    const res = buildRes();

    await FinanceController.allocateProviderReceipt(
      buildReq({
        params: { organisationId: "org_victim", receiptId: RECEIPT_ID },
        organisationId: "org_attacker",
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(ProviderReceiptService.allocate).not.toHaveBeenCalled();
  });

  it("takes the actor from the session and refuses without one", async () => {
    // An allocation is an audited money movement. A request-supplied actor
    // would put a name on it that nobody verified.
    const res = buildRes();

    await FinanceController.allocateProviderReceipt(
      buildReq({ userId: undefined, body: { actorId: "somebody_else" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(ProviderReceiptService.allocate).not.toHaveBeenCalled();
  });

  it("passes the session actor through rather than anything in the body", async () => {
    await FinanceController.allocateProviderReceipt(
      buildReq({
        body: {
          expectedVersion: 3,
          idempotencyKey: "key-1",
          actorId: "somebody_else",
          allocations: [{ invoiceId: INVOICE_ID, amount: 25 }],
        },
      }),
      buildRes(),
    );

    expect(ProviderReceiptService.allocate).toHaveBeenCalledWith({
      organisationId: "org_1",
      receiptId: RECEIPT_ID,
      expectedVersion: 3,
      idempotencyKey: "key-1",
      actorId: "user_1",
      allocations: [{ invoiceId: INVOICE_ID, amount: 25 }],
    });
  });

  it("rejects a malformed receipt id before reaching the service", async () => {
    const res = buildRes();

    await FinanceController.allocateProviderReceipt(
      buildReq({
        params: { organisationId: "org_1", receiptId: "not-a-uuid" },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ProviderReceiptService.allocate).not.toHaveBeenCalled();
  });

  it.each([
    [
      "no version",
      {
        idempotencyKey: "k",
        allocations: [{ invoiceId: INVOICE_ID, amount: 25 }],
      },
    ],
    [
      "no idempotency key",
      {
        expectedVersion: 1,
        allocations: [{ invoiceId: INVOICE_ID, amount: 25 }],
      },
    ],
    ["no lines", { expectedVersion: 1, idempotencyKey: "k", allocations: [] }],
    [
      "a zero line",
      {
        expectedVersion: 1,
        idempotencyKey: "k",
        allocations: [{ invoiceId: INVOICE_ID, amount: 0 }],
      },
    ],
    [
      "a negative line",
      {
        expectedVersion: 1,
        idempotencyKey: "k",
        allocations: [{ invoiceId: INVOICE_ID, amount: -5 }],
      },
    ],
    [
      "a non-uuid invoice",
      {
        expectedVersion: 1,
        idempotencyKey: "k",
        allocations: [{ invoiceId: "nope", amount: 5 }],
      },
    ],
  ])("refuses a body with %s", async (_label, body) => {
    // Neither field has a default on purpose: a client that omitted either
    // would double-post money under exactly the conditions this endpoint
    // exists to survive.
    const res = buildRes();

    await FinanceController.allocateProviderReceipt(buildReq({ body }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ProviderReceiptService.allocate).not.toHaveBeenCalled();
  });

  it("refuses an invoice named twice rather than summing the lines", async () => {
    // Summing would answer a request the caller did not make, and the one
    // allocation per receipt and invoice rule would refuse the second line
    // downstream as a conflict - which reads as somebody else's doing.
    const res = buildRes();

    await FinanceController.allocateProviderReceipt(
      buildReq({
        body: {
          expectedVersion: 3,
          idempotencyKey: "key-1",
          allocations: [
            { invoiceId: INVOICE_ID, amount: 10 },
            { invoiceId: INVOICE_ID, amount: 15 },
          ],
        },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ProviderReceiptService.allocate).not.toHaveBeenCalled();
  });

  it("allows one capture to be split across different invoices", async () => {
    await FinanceController.allocateProviderReceipt(
      buildReq({
        body: {
          expectedVersion: 3,
          idempotencyKey: "key-1",
          allocations: [
            { invoiceId: INVOICE_ID, amount: 10 },
            { invoiceId: OTHER_INVOICE_ID, amount: 15 },
          ],
        },
      }),
      buildRes(),
    );

    expect(ProviderReceiptService.allocate).toHaveBeenCalled();
  });

  it.each([
    ["NOT_FOUND", { outcome: "NOT_FOUND" }, 404],
    ["NOT_ATTRIBUTED", { outcome: "NOT_ATTRIBUTED" }, 409],
    ["FULLY_REFUNDED", { outcome: "FULLY_REFUNDED" }, 409],
    ["ACCOUNT_MISMATCH", { outcome: "ACCOUNT_MISMATCH" }, 409],
    ["VERSION_CONFLICT", { outcome: "VERSION_CONFLICT", version: 7 }, 409],
    [
      "EXCEEDS_RESIDUAL",
      { outcome: "EXCEEDS_RESIDUAL", residual: 10, requested: 25 },
      409,
    ],
    [
      "INVOICE_NOT_ELIGIBLE",
      {
        outcome: "INVOICE_NOT_ELIGIBLE",
        invoiceId: INVOICE_ID,
        reason: "CURRENCY_MISMATCH",
      },
      409,
    ],
  ])("answers %s with %i", async (_label, outcome, status) => {
    (ProviderReceiptService.allocate as jest.Mock).mockResolvedValue(outcome);
    const res = buildRes();

    await FinanceController.allocateProviderReceipt(buildReq(), res);

    expect(res.status).toHaveBeenCalledWith(status);
  });

  it("returns the details a client needs to recover from a stale read", async () => {
    // A UI told to reload needs the version to reload TO, or the next attempt
    // sends the same stale number.
    (ProviderReceiptService.allocate as jest.Mock).mockResolvedValue({
      outcome: "VERSION_CONFLICT",
      version: 7,
    });
    const res = buildRes();

    await FinanceController.allocateProviderReceipt(buildReq(), res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: { code: "VERSION_CONFLICT", version: 7 },
      }),
    );
  });

  it("names the invoice and the reason when a line is not eligible", async () => {
    (ProviderReceiptService.allocate as jest.Mock).mockResolvedValue({
      outcome: "INVOICE_NOT_ELIGIBLE",
      invoiceId: INVOICE_ID,
      reason: "EXCEEDS_INVOICE_BALANCE",
    });
    const res = buildRes();

    await FinanceController.allocateProviderReceipt(buildReq(), res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: {
          code: "INVOICE_NOT_ELIGIBLE",
          invoiceId: INVOICE_ID,
          reason: "EXCEEDS_INVOICE_BALANCE",
        },
      }),
    );
  });

  it("reports the residual after a successful allocation", async () => {
    (ProviderReceiptService.allocate as jest.Mock).mockResolvedValue({
      ...applied,
      remainingAmount: 15,
    });
    const res = buildRes();

    await FinanceController.allocateProviderReceipt(buildReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: expect.objectContaining({ remainingAmount: 15 }),
      meta: { replayed: false },
      error: null,
    });
  });

  it("answers a retry 200 and says so, rather than failing the caller's own write", async () => {
    // Answering 409 here would teach clients to treat a successful retry as a
    // failure and stop retrying at all.
    (ProviderReceiptService.allocate as jest.Mock).mockResolvedValue({
      ...applied,
      outcome: "REPLAYED",
    });
    const res = buildRes();

    await FinanceController.allocateProviderReceipt(buildReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ meta: { replayed: true } }),
    );
  });

  it("answers 500 without leaking the failure", async () => {
    (ProviderReceiptService.allocate as jest.Mock).mockRejectedValue(
      new Error("connection reset"),
    );
    const res = buildRes();

    await FinanceController.allocateProviderReceipt(buildReq(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });
});

describe("FinanceController.getClientAccountCredit", () => {
  const PARENT = "22222222-2222-4222-8222-222222222222";

  const buildRes = () =>
    ({
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }) as unknown as Response;

  const buildReq = (overrides: Record<string, unknown> = {}) =>
    ({
      params: { organisationId: "org_1", parentId: PARENT },
      query: {},
      organisationId: "org_1",
      ...overrides,
    }) as unknown as Request;

  beforeEach(() => {
    jest.resetAllMocks();
    (ClientAccountService.getAccountCredit as jest.Mock).mockResolvedValue([]);
  });

  it("scopes the credit to the authorized organisation, not the path", async () => {
    // A Parent is global. Without the organisation coming from the session,
    // anyone holding the permission in their own practice could read what a
    // shared client has paid another practice.
    const res = buildRes();

    await FinanceController.getClientAccountCredit(
      buildReq({
        params: { organisationId: "org_victim", parentId: PARENT },
        organisationId: "org_attacker",
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(ClientAccountService.getAccountCredit).not.toHaveBeenCalled();
  });

  it("rejects a client id that is not a uuid without reaching the service", async () => {
    const res = buildRes();

    await FinanceController.getClientAccountCredit(
      buildReq({ params: { organisationId: "org_1", parentId: "not-a-uuid" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ClientAccountService.getAccountCredit).not.toHaveBeenCalled();
  });

  it("returns the per-currency credit the service reports", async () => {
    const credit = [
      {
        currency: "gbp",
        availableCredit: 75,
        lines: [
          {
            receiptId: "receipt-1",
            provider: "STRIPE",
            paymentRef: "pi_1",
            invoiceId: "invoice-1",
            capturedAt: new Date("2026-09-01T10:00:00.000Z"),
            availableCredit: 75,
          },
        ],
      },
    ];
    (ClientAccountService.getAccountCredit as jest.Mock).mockResolvedValue(
      credit,
    );
    const res = buildRes();

    await FinanceController.getClientAccountCredit(buildReq(), res);

    expect(ClientAccountService.getAccountCredit).toHaveBeenCalledWith({
      organisationId: "org_1",
      parentId: PARENT,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: credit, error: null });
  });

  it("answers an empty list the same for no credit and for an unknown client", async () => {
    const res = buildRes();

    await FinanceController.getClientAccountCredit(buildReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: [], error: null });
  });

  it("reports a failed read as a server error rather than as an empty account", async () => {
    // Answering [] on a thrown query would tell an operator the client has no
    // credit, which is the one wrong answer that looks like a real one.
    (ClientAccountService.getAccountCredit as jest.Mock).mockRejectedValue(
      new Error("database down"),
    );
    const res = buildRes();

    await FinanceController.getClientAccountCredit(buildReq(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });
});

describe("FinanceController.getClientAccountAllocationProposal", () => {
  const PARENT = "22222222-2222-4222-8222-222222222222";

  const buildRes = () =>
    ({
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }) as unknown as Response;

  const buildReq = (overrides: Record<string, unknown> = {}) =>
    ({
      params: { organisationId: "org_1", parentId: PARENT },
      query: {},
      organisationId: "org_1",
      ...overrides,
    }) as unknown as Request;

  beforeEach(() => {
    jest.resetAllMocks();
    (ClientAccountService.proposeAllocation as jest.Mock).mockResolvedValue([]);
  });

  it("scopes the proposal to the authorized organisation, not the path", async () => {
    const res = buildRes();

    await FinanceController.getClientAccountAllocationProposal(
      buildReq({
        params: { organisationId: "org_victim", parentId: PARENT },
        organisationId: "org_attacker",
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(ClientAccountService.proposeAllocation).not.toHaveBeenCalled();
  });

  it("rejects a client id that is not a uuid without reaching the service", async () => {
    const res = buildRes();

    await FinanceController.getClientAccountAllocationProposal(
      buildReq({ params: { organisationId: "org_1", parentId: "not-a-uuid" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ClientAccountService.proposeAllocation).not.toHaveBeenCalled();
  });

  it("returns the plan with the versions it was taken from", async () => {
    const proposal = [
      {
        currency: "gbp",
        availableCredit: 150,
        proposedAmount: 150,
        residualCredit: 0,
        outstandingBefore: 180,
        outstandingAfter: 30,
        lines: [
          { receiptId: "receipt-1", invoiceId: "invoice-1", amount: 100 },
          { receiptId: "receipt-1", invoiceId: "invoice-2", amount: 50 },
        ],
        credits: [
          {
            receiptId: "receipt-1",
            version: 3,
            capturedAt: new Date("2026-09-01T10:00:00.000Z"),
            availableCredit: 150,
          },
        ],
      },
    ];
    (ClientAccountService.proposeAllocation as jest.Mock).mockResolvedValue(
      proposal,
    );
    const res = buildRes();

    await FinanceController.getClientAccountAllocationProposal(buildReq(), res);

    expect(ClientAccountService.proposeAllocation).toHaveBeenCalledWith({
      organisationId: "org_1",
      parentId: PARENT,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: proposal, error: null });
  });

  it("answers an empty list the same for nothing to propose and an unknown client", async () => {
    const res = buildRes();

    await FinanceController.getClientAccountAllocationProposal(buildReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: [], error: null });
  });

  it("reports a failed read as a server error rather than as nothing to apply", async () => {
    // Answering [] on a thrown query would tell an operator this client has no
    // credit to apply, which is the one wrong answer that looks like a real one.
    (ClientAccountService.proposeAllocation as jest.Mock).mockRejectedValue(
      new Error("database down"),
    );
    const res = buildRes();

    await FinanceController.getClientAccountAllocationProposal(buildReq(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });
});
describe("FinanceController.applyClientAccountAllocation", () => {
  const PARENT = "22222222-2222-4222-8222-222222222222";
  const RECEIPT_A = "33333333-3333-4333-8333-333333333333";
  const RECEIPT_B = "44444444-4444-4444-8444-444444444444";
  const INVOICE_A = "55555555-5555-4555-8555-555555555555";

  const buildRes = () =>
    ({
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }) as unknown as Response;

  const body = (overrides: Record<string, unknown> = {}) => ({
    idempotencyKey: "key-1",
    receipts: [
      {
        receiptId: RECEIPT_A,
        expectedVersion: 3,
        allocations: [{ invoiceId: INVOICE_A, amount: 25 }],
      },
    ],
    ...overrides,
  });

  const buildReq = (overrides: Record<string, unknown> = {}) =>
    ({
      params: { organisationId: "org_1", parentId: PARENT },
      organisationId: "org_1",
      userId: "user_1",
      body: body(),
      ...overrides,
    }) as unknown as Request;

  const applied = {
    outcome: "APPLIED" as const,
    appliedAmount: 25,
    steps: [{ receiptId: RECEIPT_A, result: { outcome: "APPLIED" } }],
    notAttempted: [],
  };

  beforeEach(() => {
    jest.resetAllMocks();
    (ClientAccountService.applyAllocation as jest.Mock).mockResolvedValue(
      applied,
    );
  });

  it("scopes the plan to the authorized organisation, not the path", async () => {
    const res = buildRes();

    await FinanceController.applyClientAccountAllocation(
      buildReq({
        params: { organisationId: "org_victim", parentId: PARENT },
        organisationId: "org_attacker",
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(ClientAccountService.applyAllocation).not.toHaveBeenCalled();
  });

  it("takes the actor from the session and refuses without one", async () => {
    const res = buildRes();

    await FinanceController.applyClientAccountAllocation(
      buildReq({ userId: undefined }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(ClientAccountService.applyAllocation).not.toHaveBeenCalled();
  });

  it("passes the session actor through rather than anything in the body", async () => {
    await FinanceController.applyClientAccountAllocation(
      buildReq({ body: body({ actorId: "somebody_else" }) }),
      buildRes(),
    );

    expect(ClientAccountService.applyAllocation).toHaveBeenCalledWith({
      organisationId: "org_1",
      parentId: PARENT,
      actorId: "user_1",
      idempotencyKey: "key-1",
      receipts: body().receipts,
    });
  });

  it("rejects a client id that is not a uuid without reaching the service", async () => {
    const res = buildRes();

    await FinanceController.applyClientAccountAllocation(
      buildReq({ params: { organisationId: "org_1", parentId: "not-a-uuid" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ClientAccountService.applyAllocation).not.toHaveBeenCalled();
  });

  it("rejects a plan with no idempotency key", async () => {
    const res = buildRes();

    await FinanceController.applyClientAccountAllocation(
      buildReq({ body: body({ idempotencyKey: "  " }) }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ClientAccountService.applyAllocation).not.toHaveBeenCalled();
  });

  it("rejects a capture with no expectedVersion", async () => {
    const res = buildRes();

    await FinanceController.applyClientAccountAllocation(
      buildReq({
        body: body({
          receipts: [
            {
              receiptId: RECEIPT_A,
              allocations: [{ invoiceId: INVOICE_A, amount: 25 }],
            },
          ],
        }),
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ClientAccountService.applyAllocation).not.toHaveBeenCalled();
  });

  it("rejects a non-positive line", async () => {
    const res = buildRes();

    await FinanceController.applyClientAccountAllocation(
      buildReq({
        body: body({
          receipts: [
            {
              receiptId: RECEIPT_A,
              expectedVersion: 3,
              allocations: [{ invoiceId: INVOICE_A, amount: 0 }],
            },
          ],
        }),
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ClientAccountService.applyAllocation).not.toHaveBeenCalled();
  });

  it("refuses a plan that names one capture twice", async () => {
    // The second entry would carry this plan's key into a capture the first
    // already decided, and come back REPLAYED with the first entry's lines.
    const res = buildRes();

    await FinanceController.applyClientAccountAllocation(
      buildReq({
        body: body({
          receipts: [
            {
              receiptId: RECEIPT_A,
              expectedVersion: 3,
              allocations: [{ invoiceId: INVOICE_A, amount: 25 }],
            },
            {
              receiptId: RECEIPT_A,
              expectedVersion: 3,
              allocations: [{ invoiceId: INVOICE_A, amount: 10 }],
            },
          ],
        }),
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(ClientAccountService.applyAllocation).not.toHaveBeenCalled();
  });

  it("refuses one capture naming the same invoice twice", async () => {
    const res = buildRes();

    await FinanceController.applyClientAccountAllocation(
      buildReq({
        body: body({
          receipts: [
            {
              receiptId: RECEIPT_A,
              expectedVersion: 3,
              allocations: [
                { invoiceId: INVOICE_A, amount: 25 },
                { invoiceId: INVOICE_A, amount: 10 },
              ],
            },
          ],
        }),
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ClientAccountService.applyAllocation).not.toHaveBeenCalled();
  });

  it("allows two captures to pay the same invoice", async () => {
    // The normal output of the planner: one debt larger than one capture.
    await FinanceController.applyClientAccountAllocation(
      buildReq({
        body: body({
          receipts: [
            {
              receiptId: RECEIPT_A,
              expectedVersion: 3,
              allocations: [{ invoiceId: INVOICE_A, amount: 25 }],
            },
            {
              receiptId: RECEIPT_B,
              expectedVersion: 1,
              allocations: [{ invoiceId: INVOICE_A, amount: 10 }],
            },
          ],
        }),
      }),
      buildRes(),
    );

    expect(ClientAccountService.applyAllocation).toHaveBeenCalled();
  });

  it("answers a zero-write refusal 409 with the object it names", async () => {
    (ClientAccountService.applyAllocation as jest.Mock).mockResolvedValue({
      outcome: "RECEIPT_NOT_THIS_CLIENT",
      receiptId: RECEIPT_B,
    });
    const res = buildRes();

    await FinanceController.applyClientAccountAllocation(buildReq(), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: { code: "RECEIPT_NOT_THIS_CLIENT", receiptId: RECEIPT_B },
      }),
    );
  });

  it("answers a plan that stopped part way 200, because money moved", async () => {
    // A 409 here would tell a client to retry a request that already applied
    // a capture. The body says how far it got instead.
    (ClientAccountService.applyAllocation as jest.Mock).mockResolvedValue({
      outcome: "STOPPED",
      appliedAmount: 25,
      steps: [
        { receiptId: RECEIPT_A, result: { outcome: "APPLIED" } },
        {
          receiptId: RECEIPT_B,
          result: { outcome: "VERSION_CONFLICT", version: 7 },
        },
      ],
      notAttempted: ["receipt-3"],
    });
    const res = buildRes();

    await FinanceController.applyClientAccountAllocation(buildReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: {
        outcome: "STOPPED",
        appliedAmount: 25,
        steps: [
          { receiptId: RECEIPT_A, result: { outcome: "APPLIED" } },
          {
            receiptId: RECEIPT_B,
            result: { outcome: "VERSION_CONFLICT", version: 7 },
          },
        ],
        notAttempted: ["receipt-3"],
      },
      error: null,
    });
  });

  it("returns what was applied on a plan that ran through", async () => {
    const res = buildRes();

    await FinanceController.applyClientAccountAllocation(buildReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: {
        outcome: "APPLIED",
        appliedAmount: 25,
        steps: applied.steps,
        notAttempted: [],
      },
      error: null,
    });
  });

  it("reports a failed write as a server error rather than as nothing applied", async () => {
    (ClientAccountService.applyAllocation as jest.Mock).mockRejectedValue(
      new Error("database down"),
    );
    const res = buildRes();

    await FinanceController.applyClientAccountAllocation(buildReq(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });
});
