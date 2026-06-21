import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { Request, Response } from "express";
import { FinanceController } from "../../../src/controllers/app/finance.controller";
import { StripeService } from "../../../src/services/stripe.service";
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
});
