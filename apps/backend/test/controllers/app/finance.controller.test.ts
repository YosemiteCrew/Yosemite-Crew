import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { Request, Response } from "express";
import { FinanceController } from "../../../src/controllers/app/finance.controller";
import { StripeService } from "../../../src/services/stripe.service";
import { InvoiceService } from "../../../src/services/invoice.service";
import logger from "../../../src/utils/logger";

jest.mock("../../../src/services/stripe.service", () => ({
  StripeService: {
    retrievePaymentIntent: jest.fn(),
  },
}));

jest.mock("../../../src/services/invoice.service", () => ({
  InvoiceService: {
    createDraftForAppointment: jest.fn(),
    listForOrganisation: jest.fn(),
    getByAppointmentId: jest.fn(),
    listForParent: jest.fn(),
    listForCompanion: jest.fn(),
    addItemsToInvoice: jest.fn(),
    getById: jest.fn(),
    bootstrapForAppointment: jest.fn(),
    finalizeTaxForInvoice: jest.fn(),
    previewTaxForInvoice: jest.fn(),
    markAppointmentReadyForBilling: jest.fn(),
    settleInvoiceAtCloseout: jest.fn(),
    handleInvoiceCancellation: jest.fn(),
  },
}));

jest.mock("../../../src/services/finance/payment", () => ({
  FinancePaymentService: {
    recordInvoicePayment: jest.fn(),
    refundPaymentById: jest.fn(),
    createCheckoutSessionForInvoice: jest.fn(),
    createPaymentIntentForInvoice: jest.fn(),
  },
}));

jest.mock("../../../src/services/finance/subscription", () => ({
  FinanceSubscriptionService: {
    getSubscriptionOverview: jest.fn(),
    resolveSubscriptionSeatSyncPlan: jest.fn(),
    getUsageOverview: jest.fn(),
    getCurrentSubscription: jest.fn(),
    upsertSubscription: jest.fn(),
    listUsageSnapshots: jest.fn(),
    recordBusinessCheckoutCustomer: jest.fn(),
    recordBusinessCheckoutCompleted: jest.fn(),
    recordSubscriptionUpdated: jest.fn(),
    recordSubscriptionDeleted: jest.fn(),
    recordSubscriptionInvoicePaid: jest.fn(),
    recordSubscriptionInvoiceFailed: jest.fn(),
    recordUsageEvent: jest.fn(),
    captureUsageSnapshot: jest.fn(),
  },
}));

jest.mock("../../../src/services/finance/events", () => ({
  FinanceEventService: {
    recordEvent: jest.fn(),
  },
}));

jest.mock("../../../src/services/authUserMobile.service", () => ({
  AuthUserMobileService: {
    getByProviderUserId: jest.fn(),
  },
}));

jest.mock("../../../src/controllers/web/stripe.controller", () => ({
  StripeController: {
    webhook: jest.fn(),
  },
}));

jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("FinanceController", () => {
  const mockedStripeService = jest.mocked(StripeService);
  const mockedLogger = jest.mocked(logger);

  let req: Partial<Request>;
  let res: Partial<Response>;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = { params: {}, body: {}, query: {} };
    res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;
  });

  it("retrieves the Stripe payment intent by id", async () => {
    req.params = { paymentIntentId: "pi_123" };
    mockedStripeService.retrievePaymentIntent.mockResolvedValue({
      id: "pi_123",
      amount: 2500,
      currency: "usd",
    } as never);

    await FinanceController.retrievePaymentIntent(
      req as Request,
      res as Response,
    );

    expect(mockedStripeService.retrievePaymentIntent).toHaveBeenCalledWith(
      "pi_123",
    );
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      data: {
        id: "pi_123",
        amount: 2500,
        currency: "usd",
      },
      meta: null,
      error: null,
    });
  });

  it("rejects missing payment intent ids", async () => {
    await FinanceController.retrievePaymentIntent(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Payment Intent Id is required",
    });
  });

  it("returns a 500 on unexpected Stripe errors", async () => {
    req.params = { paymentIntentId: "pi_123" };
    mockedStripeService.retrievePaymentIntent.mockRejectedValue(
      new Error("boom"),
    );

    await FinanceController.retrievePaymentIntent(
      req as Request,
      res as Response,
    );

    expect(mockedLogger.error).toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Internal server error",
    });
  });

  describe("listInvoices", () => {
    const mockedInvoiceService = jest.mocked(InvoiceService);

    it("scopes to the appointment when both organisationId and appointmentId are provided", async () => {
      req.query = { organisationId: "org-1", appointmentId: "appt-1" };
      mockedInvoiceService.getByAppointmentId.mockResolvedValueOnce([
        { id: "inv-1" },
      ] as never);

      await FinanceController.listInvoices(req as Request, res as Response);

      // Regression: with both filters present, the result must stay scoped to the
      // appointment AND the authorized organisation rather than returning every
      // invoice in the organisation or another org's appointment invoices.
      expect(mockedInvoiceService.getByAppointmentId).toHaveBeenCalledWith(
        "appt-1",
        "org-1",
      );
      expect(mockedInvoiceService.listForOrganisation).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("scopes appointment invoices to the authorized org, not the raw query value", async () => {
      // The org authorized by withOrgPermissions is exposed on req.organisationId
      // (it may have been supplied via header/param). When the query param is
      // absent, scoping must still use the authorized org so an appointment id
      // from another tenant cannot leak that tenant's invoices.
      req.query = { appointmentId: "appt-other-org" };
      (req as unknown as { organisationId: string }).organisationId =
        "org-auth";
      mockedInvoiceService.getByAppointmentId.mockResolvedValueOnce(
        [] as never,
      );

      await FinanceController.listInvoices(req as Request, res as Response);

      expect(mockedInvoiceService.getByAppointmentId).toHaveBeenCalledWith(
        "appt-other-org",
        "org-auth",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("lists organisation invoices when only organisationId is provided", async () => {
      req.query = { organisationId: "org-1" };
      mockedInvoiceService.listForOrganisation.mockResolvedValueOnce(
        [] as never,
      );

      await FinanceController.listInvoices(req as Request, res as Response);

      expect(mockedInvoiceService.listForOrganisation).toHaveBeenCalledWith(
        "org-1",
      );
      expect(mockedInvoiceService.getByAppointmentId).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("rejects when no filter is provided", async () => {
      req.query = {};

      await FinanceController.listInvoices(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  it("settles an invoice at visit closeout", async () => {
    req.params = { invoiceId: "inv-closeout" };
    req.body = {
      settlementChannel: "CASH",
      reference: "front-desk",
      receivedAt: "2026-06-24T10:15:00.000Z",
    };
    (req as unknown as { organisationId: string }).organisationId = "org-1";
    jest.mocked(InvoiceService).settleInvoiceAtCloseout.mockResolvedValueOnce({
      id: "inv-closeout",
      status: "PAID",
    } as never);

    await FinanceController.settleInvoiceAtCloseout(
      req as Request,
      res as Response,
    );

    expect(InvoiceService.settleInvoiceAtCloseout).toHaveBeenCalledWith(
      "inv-closeout",
      "org-1",
      expect.objectContaining({
        settlementChannel: "CASH",
        reference: "front-desk",
        receivedAt: new Date("2026-06-24T10:15:00.000Z"),
      }),
    );
    expect(statusMock).toHaveBeenCalledWith(200);
  });
});
