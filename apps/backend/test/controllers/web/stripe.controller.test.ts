import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { StripeController } from "../../../src/controllers/web/stripe.controller";
import { StripeService } from "../../../src/services/stripe.service";
import { AuthUserMobileService } from "../../../src/services/authUserMobile.service";
import {
  AppointmentPrismaService,
  AppointmentPrismaServiceError,
} from "../../../src/services/appointment.prisma.service";
import { FinancePaymentError } from "../../../src/services/finance/payment";
import logger from "../../../src/utils/logger";

// StripeService is fully stubbed: the controller only ever delegates to it, so
// none of the real Stripe SDK / Prisma module-load work needs to run here.
jest.mock("../../../src/services/stripe.service", () => ({
  StripeService: {
    createOrGetConnectedAccount: jest.fn(),
    getAccountStatus: jest.fn(),
    createBusinessCheckoutSession: jest.fn(),
    createCustomerPortalSession: jest.fn(),
    syncSubscriptionSeats: jest.fn(),
    refundPaymentIntent: jest.fn(),
    verifyWebhook: jest.fn(),
    verifyConnectWebhook: jest.fn(),
    handleWebhookEvent: jest.fn(),
    createPaymentIntentForAppointment: jest.fn(),
    createPaymentIntentForInvoice: jest.fn(),
    retrievePaymentIntent: jest.fn(),
    retrieveCheckoutSession: jest.fn(),
    createOnboardingLink: jest.fn(),
  },
}));

jest.mock("../../../src/services/authUserMobile.service", () => ({
  AuthUserMobileService: {
    getByProviderUserId: jest.fn(),
  },
}));

// Keep a real AppointmentPrismaServiceError so the controller's `instanceof`
// status-code branch is exercised with genuine instances.
jest.mock("../../../src/services/appointment.prisma.service", () => {
  class AppointmentPrismaServiceError extends Error {
    public readonly statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.name = "AppointmentPrismaServiceError";
      this.statusCode = statusCode;
    }
  }
  return {
    AppointmentPrismaService: { getById: jest.fn() },
    AppointmentPrismaServiceError,
  };
});

// Same idea for FinancePaymentError.
jest.mock("../../../src/services/finance/payment", () => {
  class FinancePaymentError extends Error {
    public readonly statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.name = "FinancePaymentError";
      this.statusCode = statusCode;
    }
  }
  return { FinancePaymentError };
});

jest.mock("../../../src/utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const mockedStripe = StripeService as unknown as {
  createOrGetConnectedAccount: jest.Mock<any>;
  getAccountStatus: jest.Mock<any>;
  createBusinessCheckoutSession: jest.Mock<any>;
  createCustomerPortalSession: jest.Mock<any>;
  syncSubscriptionSeats: jest.Mock<any>;
  refundPaymentIntent: jest.Mock<any>;
  verifyWebhook: jest.Mock<any>;
  verifyConnectWebhook: jest.Mock<any>;
  handleWebhookEvent: jest.Mock<any>;
  createPaymentIntentForAppointment: jest.Mock<any>;
  createPaymentIntentForInvoice: jest.Mock<any>;
  retrievePaymentIntent: jest.Mock<any>;
  retrieveCheckoutSession: jest.Mock<any>;
  createOnboardingLink: jest.Mock<any>;
};

const mockedGetByProviderUserId =
  AuthUserMobileService.getByProviderUserId as unknown as jest.Mock<any>;
const mockedGetById =
  AppointmentPrismaService.getById as unknown as jest.Mock<any>;
const mockedLogger = logger as unknown as { error: jest.Mock<any> };

const buildResponse = () => {
  const json = jest.fn();
  const send = jest.fn();
  const status = jest.fn().mockReturnValue({ json, send });
  return { status, json, send } as unknown as Response & {
    status: jest.Mock;
    json: jest.Mock;
    send: jest.Mock;
  };
};

const buildReq = (overrides: Record<string, unknown> = {}) =>
  ({
    params: {},
    headers: {},
    body: {},
    ...overrides,
  }) as unknown as Request;

describe("StripeController", () => {
  let res: ReturnType<typeof buildResponse>;

  beforeEach(() => {
    jest.clearAllMocks();
    res = buildResponse();
  });

  describe("createOrGetConnectedAccount", () => {
    it("returns 200 with the service result", async () => {
      mockedStripe.createOrGetConnectedAccount.mockResolvedValue({
        id: "acct_1",
      });
      const req = buildReq({ params: { organisationId: "org_1" } });

      await StripeController.createOrGetConnectedAccount(req, res);

      expect(mockedStripe.createOrGetConnectedAccount).toHaveBeenCalledWith(
        "org_1",
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: "acct_1" });
    });

    it("returns 400 with the error message when the service throws", async () => {
      mockedStripe.createOrGetConnectedAccount.mockRejectedValue(
        new Error("boom"),
      );
      const req = buildReq({ params: { organisationId: "org_1" } });

      await StripeController.createOrGetConnectedAccount(req, res);

      expect(mockedLogger.error).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "boom" });
    });

    it("falls back to 'Unknown error' for a non-Error rejection", async () => {
      mockedStripe.createOrGetConnectedAccount.mockRejectedValue("nope");
      const req = buildReq({ params: { organisationId: "org_1" } });

      await StripeController.createOrGetConnectedAccount(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Unknown error" });
    });
  });

  describe("getAccountStatus", () => {
    it("returns 200 with the account status", async () => {
      mockedStripe.getAccountStatus.mockResolvedValue({ ready: true });
      const req = buildReq({ params: { organisationId: "org_2" } });

      await StripeController.getAccountStatus(req, res);

      expect(mockedStripe.getAccountStatus).toHaveBeenCalledWith("org_2");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ ready: true });
    });

    it("returns 400 when the service throws", async () => {
      mockedStripe.getAccountStatus.mockRejectedValue(new Error("status fail"));
      const req = buildReq({ params: { organisationId: "org_2" } });

      await StripeController.getAccountStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "status fail" });
    });

    it("falls back to 'Unknown error' for a non-Error rejection", async () => {
      mockedStripe.getAccountStatus.mockRejectedValue({ oops: true });
      const req = buildReq({ params: { organisationId: "org_2" } });

      await StripeController.getAccountStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Unknown error" });
    });
  });

  describe("createBusinessCheckout", () => {
    it("creates a checkout session for a monthly interval", async () => {
      mockedStripe.createBusinessCheckoutSession.mockResolvedValue({
        url: "https://checkout",
      });
      const req = buildReq({
        params: { organisationId: "org_3" },
        body: { interval: "month" },
      });

      await StripeController.createBusinessCheckout(req, res);

      expect(mockedStripe.createBusinessCheckoutSession).toHaveBeenCalledWith(
        "org_3",
        "month",
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ url: "https://checkout" });
    });

    it("creates a checkout session for a yearly interval", async () => {
      mockedStripe.createBusinessCheckoutSession.mockResolvedValue({
        url: "https://checkout-year",
      });
      const req = buildReq({
        params: { organisationId: "org_3" },
        body: { interval: "year" },
      });

      await StripeController.createBusinessCheckout(req, res);

      expect(mockedStripe.createBusinessCheckoutSession).toHaveBeenCalledWith(
        "org_3",
        "year",
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("returns 400 when the interval is invalid", async () => {
      const req = buildReq({
        params: { organisationId: "org_3" },
        body: { interval: "weekly" },
      });

      await StripeController.createBusinessCheckout(req, res);

      expect(mockedStripe.createBusinessCheckoutSession).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "interval must be 'month' or 'year'",
      });
    });

    it("returns 400 when the body has no interval key", async () => {
      const req = buildReq({
        params: { organisationId: "org_3" },
        body: {},
      });

      await StripeController.createBusinessCheckout(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "interval must be 'month' or 'year'",
      });
    });

    it("returns 400 when the body is null", async () => {
      const req = buildReq({
        params: { organisationId: "org_3" },
        body: null,
      });

      await StripeController.createBusinessCheckout(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "interval must be 'month' or 'year'",
      });
    });

    it("returns 400 when the body is not an object", async () => {
      const req = buildReq({
        params: { organisationId: "org_3" },
        body: "not-an-object",
      });

      await StripeController.createBusinessCheckout(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "interval must be 'month' or 'year'",
      });
    });

    it("returns 400 when the service throws", async () => {
      mockedStripe.createBusinessCheckoutSession.mockRejectedValue(
        new Error("checkout down"),
      );
      const req = buildReq({
        params: { organisationId: "org_3" },
        body: { interval: "month" },
      });

      await StripeController.createBusinessCheckout(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "checkout down" });
    });

    it("falls back to 'Unknown error' for a non-Error rejection", async () => {
      mockedStripe.createBusinessCheckoutSession.mockRejectedValue(42);
      const req = buildReq({
        params: { organisationId: "org_3" },
        body: { interval: "year" },
      });

      await StripeController.createBusinessCheckout(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Unknown error" });
    });
  });

  describe("createBillingPortal", () => {
    it("returns 200 with the portal session", async () => {
      mockedStripe.createCustomerPortalSession.mockResolvedValue({
        url: "https://portal",
      });
      const req = buildReq({ params: { organisationId: "org_4" } });

      await StripeController.createBillingPortal(req, res);

      expect(mockedStripe.createCustomerPortalSession).toHaveBeenCalledWith(
        "org_4",
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ url: "https://portal" });
    });

    it("returns 400 when the service throws", async () => {
      mockedStripe.createCustomerPortalSession.mockRejectedValue(
        new Error("portal fail"),
      );
      const req = buildReq({ params: { organisationId: "org_4" } });

      await StripeController.createBillingPortal(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "portal fail" });
    });

    it("falls back to 'Unknown error' for a non-Error rejection", async () => {
      mockedStripe.createCustomerPortalSession.mockRejectedValue(null);
      const req = buildReq({ params: { organisationId: "org_4" } });

      await StripeController.createBillingPortal(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Unknown error" });
    });
  });

  describe("syncSeats", () => {
    it("returns 200 with the sync result", async () => {
      mockedStripe.syncSubscriptionSeats.mockResolvedValue({ seats: 5 });
      const req = buildReq({ params: { organisationId: "org_5" } });

      await StripeController.syncSeats(req, res);

      expect(mockedStripe.syncSubscriptionSeats).toHaveBeenCalledWith("org_5");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ seats: 5 });
    });

    it("returns 400 when the service throws", async () => {
      mockedStripe.syncSubscriptionSeats.mockRejectedValue(
        new Error("seat fail"),
      );
      const req = buildReq({ params: { organisationId: "org_5" } });

      await StripeController.syncSeats(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "seat fail" });
    });

    it("falls back to 'Unknown error' for a non-Error rejection", async () => {
      mockedStripe.syncSubscriptionSeats.mockRejectedValue("seat oops");
      const req = buildReq({ params: { organisationId: "org_5" } });

      await StripeController.syncSeats(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Unknown error" });
    });
  });

  describe("refundPayment", () => {
    it("returns 200 with the refund result", async () => {
      mockedStripe.refundPaymentIntent.mockResolvedValue({ refunded: true });
      const req = buildReq({ params: { paymentIntentId: "pi_1" } });

      await StripeController.refundPayment(req, res);

      expect(mockedStripe.refundPaymentIntent).toHaveBeenCalledWith("pi_1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ refunded: true });
    });

    it("returns 400 when the service throws", async () => {
      mockedStripe.refundPaymentIntent.mockRejectedValue(
        new Error("refund fail"),
      );
      const req = buildReq({ params: { paymentIntentId: "pi_1" } });

      await StripeController.refundPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "refund fail" });
    });

    it("falls back to 'Unknown error' for a non-Error rejection", async () => {
      mockedStripe.refundPaymentIntent.mockRejectedValue(undefined);
      const req = buildReq({ params: { paymentIntentId: "pi_1" } });

      await StripeController.refundPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Unknown error" });
    });
  });

  describe("webhook", () => {
    it("verifies the webhook and returns 200 OK", async () => {
      const event = { id: "evt_1" };
      mockedStripe.verifyWebhook.mockReturnValue(event);
      mockedStripe.handleWebhookEvent.mockResolvedValue(undefined);
      const body = Buffer.from("payload");
      const req = buildReq({
        headers: { "stripe-signature": "sig_1" },
        body,
      });

      await StripeController.webhook(
        req as Request<unknown, unknown, Buffer>,
        res,
      );

      expect(mockedStripe.verifyWebhook).toHaveBeenCalledWith(body, "sig_1");
      expect(mockedStripe.handleWebhookEvent).toHaveBeenCalledWith(event);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith("OK");
    });

    it("returns 400 when verification throws an Error", async () => {
      mockedStripe.verifyWebhook.mockImplementation(() => {
        throw new Error("bad sig");
      });
      const req = buildReq({
        headers: { "stripe-signature": "sig_bad" },
        body: Buffer.from("payload"),
      });

      await StripeController.webhook(
        req as Request<unknown, unknown, Buffer>,
        res,
      );

      expect(mockedStripe.handleWebhookEvent).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "bad sig" });
    });

    it("returns 400 with 'Unknown error' for a non-Error throw", async () => {
      mockedStripe.verifyWebhook.mockImplementation(() => {
        throw "string failure";
      });
      const req = buildReq({
        headers: {},
        body: Buffer.from("payload"),
      });

      await StripeController.webhook(
        req as Request<unknown, unknown, Buffer>,
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Unknown error" });
    });
  });

  describe("connectWebhook", () => {
    it("verifies the connect webhook and returns 200 OK", async () => {
      const event = { id: "evt_connect" };
      mockedStripe.verifyConnectWebhook.mockReturnValue(event);
      mockedStripe.handleWebhookEvent.mockResolvedValue(undefined);
      const body = Buffer.from("connect-payload");
      const req = buildReq({
        headers: { "stripe-signature": "sig_c" },
        body,
      });

      await StripeController.connectWebhook(
        req as Request<unknown, unknown, Buffer>,
        res,
      );

      expect(mockedStripe.verifyConnectWebhook).toHaveBeenCalledWith(
        body,
        "sig_c",
      );
      expect(mockedStripe.handleWebhookEvent).toHaveBeenCalledWith(event);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith("OK");
    });

    it("returns 400 when connect verification throws", async () => {
      mockedStripe.verifyConnectWebhook.mockImplementation(() => {
        throw new Error("connect bad sig");
      });
      const req = buildReq({
        headers: { "stripe-signature": "sig_bad" },
        body: Buffer.from("payload"),
      });

      await StripeController.connectWebhook(
        req as Request<unknown, unknown, Buffer>,
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "connect bad sig" });
    });

    it("returns 400 with 'Unknown error' for a non-Error throw", async () => {
      mockedStripe.verifyConnectWebhook.mockImplementation(() => {
        throw "connect string failure";
      });
      const req = buildReq({
        headers: {},
        body: Buffer.from("payload"),
      });

      await StripeController.connectWebhook(
        req as Request<unknown, unknown, Buffer>,
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Unknown error" });
    });
  });

  describe("createPaymentIntent", () => {
    it("returns 400 when the appointment id is missing", async () => {
      const req = buildReq({ params: {} });

      await StripeController.createPaymentIntent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Appointment ID is required",
      });
    });

    it("returns 403 when the caller is bound to no tenant", async () => {
      const req = buildReq({ params: { appointmentId: "appt_1" } });

      await StripeController.createPaymentIntent(req, res);

      expect(mockedGetById).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Caller is not bound to a tenant",
      });
    });

    it("resolves the appointment by organisation scope and returns 200", async () => {
      mockedGetById.mockResolvedValue({ id: "appt_1" });
      mockedStripe.createPaymentIntentForAppointment.mockResolvedValue({
        clientSecret: "cs_1",
      });
      const req = buildReq({
        params: { appointmentId: "appt_1" },
        organisationId: "org_9",
      });

      await StripeController.createPaymentIntent(req, res);

      expect(mockedGetById).toHaveBeenCalledWith("appt_1", {
        organisationId: "org_9",
      });
      expect(
        mockedStripe.createPaymentIntentForAppointment,
      ).toHaveBeenCalledWith("appt_1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ clientSecret: "cs_1" });
    });

    it("resolves the appointment by parent scope for mobile callers", async () => {
      mockedGetByProviderUserId.mockResolvedValue({ parentId: "parent_9" });
      mockedGetById.mockResolvedValue({ id: "appt_2" });
      mockedStripe.createPaymentIntentForAppointment.mockResolvedValue({
        clientSecret: "cs_2",
      });
      const req = buildReq({
        params: { appointmentId: "appt_2" },
        userId: "user_9",
      });

      await StripeController.createPaymentIntent(req, res);

      expect(mockedGetByProviderUserId).toHaveBeenCalledWith("user_9");
      expect(mockedGetById).toHaveBeenCalledWith("appt_2", {
        parentId: "parent_9",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ clientSecret: "cs_2" });
    });

    it("returns 403 when a mobile caller has no linked parent", async () => {
      mockedGetByProviderUserId.mockResolvedValue(null);
      const req = buildReq({
        params: { appointmentId: "appt_2" },
        userId: "user_no_parent",
      });

      await StripeController.createPaymentIntent(req, res);

      expect(mockedGetById).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Caller is not bound to a tenant",
      });
    });

    it("maps AppointmentPrismaServiceError to its status code", async () => {
      mockedGetById.mockRejectedValue(
        new AppointmentPrismaServiceError("not found", 404),
      );
      const req = buildReq({
        params: { appointmentId: "appt_1" },
        organisationId: "org_9",
      });

      await StripeController.createPaymentIntent(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "not found" });
    });

    it("falls back to 400 for a generic error", async () => {
      mockedGetById.mockRejectedValue(new Error("db down"));
      const req = buildReq({
        params: { appointmentId: "appt_1" },
        organisationId: "org_9",
      });

      await StripeController.createPaymentIntent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "db down" });
    });

    it("falls back to 400 / 'Unknown error' for a non-Error rejection", async () => {
      mockedGetById.mockRejectedValue("scope check exploded");
      const req = buildReq({
        params: { appointmentId: "appt_1" },
        organisationId: "org_9",
      });

      await StripeController.createPaymentIntent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Unknown error" });
    });
  });

  describe("createPaymentIntentForInvoice", () => {
    it("returns 403 when the caller is bound to no tenant", async () => {
      const req = buildReq({ params: { invoiceId: "inv_1" } });

      await StripeController.createPaymentIntentForInvoice(req, res);

      expect(mockedStripe.createPaymentIntentForInvoice).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("returns 200 with the payment intent for an org caller", async () => {
      mockedStripe.createPaymentIntentForInvoice.mockResolvedValue({
        clientSecret: "cs_inv",
      });
      const req = buildReq({
        params: { invoiceId: "inv_1" },
        organisationId: "org_inv",
      });

      await StripeController.createPaymentIntentForInvoice(req, res);

      expect(mockedStripe.createPaymentIntentForInvoice).toHaveBeenCalledWith(
        "inv_1",
        {
          organisationId: "org_inv",
          parentId: null,
        },
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ clientSecret: "cs_inv" });
    });

    it("maps FinancePaymentError to its status code", async () => {
      mockedStripe.createPaymentIntentForInvoice.mockRejectedValue(
        new FinancePaymentError("invoice not payable", 409),
      );
      const req = buildReq({
        params: { invoiceId: "inv_1" },
        organisationId: "org_inv",
      });

      await StripeController.createPaymentIntentForInvoice(req, res);

      expect(mockedLogger.error).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ error: "invoice not payable" });
    });

    it("returns 400 for a generic error", async () => {
      mockedStripe.createPaymentIntentForInvoice.mockRejectedValue(
        new Error("unexpected"),
      );
      const req = buildReq({
        params: { invoiceId: "inv_1" },
        organisationId: "org_inv",
      });

      await StripeController.createPaymentIntentForInvoice(req, res);

      expect(mockedLogger.error).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "unexpected" });
    });

    it("returns 400 with 'Unknown error' for a non-Error throw", async () => {
      mockedStripe.createPaymentIntentForInvoice.mockRejectedValue("weird");
      const req = buildReq({
        params: { invoiceId: "inv_1" },
        organisationId: "org_inv",
      });

      await StripeController.createPaymentIntentForInvoice(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Unknown error" });
    });
  });

  describe("retrievePaymentIntent", () => {
    it("returns 403 when the caller is bound to no tenant", async () => {
      const req = buildReq({ params: { paymentIntentId: "pi_9" } });

      await StripeController.retrievePaymentIntent(req, res);

      expect(mockedStripe.retrievePaymentIntent).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("returns 200 with the payment intent", async () => {
      mockedStripe.retrievePaymentIntent.mockResolvedValue({ id: "pi_9" });
      const req = buildReq({
        params: { paymentIntentId: "pi_9" },
        organisationId: "org_pi",
      });

      await StripeController.retrievePaymentIntent(req, res);

      expect(mockedStripe.retrievePaymentIntent).toHaveBeenCalledWith("pi_9", {
        organisationId: "org_pi",
        parentId: null,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: "pi_9" });
    });

    it("maps FinancePaymentError to its status code", async () => {
      mockedStripe.retrievePaymentIntent.mockRejectedValue(
        new FinancePaymentError("forbidden", 403),
      );
      const req = buildReq({
        params: { paymentIntentId: "pi_9" },
        organisationId: "org_pi",
      });

      await StripeController.retrievePaymentIntent(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: "forbidden" });
    });

    it("returns 400 for a generic error", async () => {
      mockedStripe.retrievePaymentIntent.mockRejectedValue(
        new Error("retrieve fail"),
      );
      const req = buildReq({
        params: { paymentIntentId: "pi_9" },
        organisationId: "org_pi",
      });

      await StripeController.retrievePaymentIntent(req, res);

      expect(mockedLogger.error).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "retrieve fail" });
    });

    it("returns 400 with 'Unknown error' for a non-Error rejection", async () => {
      mockedStripe.retrievePaymentIntent.mockRejectedValue("boom");
      const req = buildReq({
        params: { paymentIntentId: "pi_9" },
        organisationId: "org_pi",
      });

      await StripeController.retrievePaymentIntent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Unknown error" });
    });
  });

  describe("retrieveCheckoutSession", () => {
    it("returns 200 with the session", async () => {
      mockedStripe.retrieveCheckoutSession.mockResolvedValue({ id: "sess_1" });
      const req = buildReq({ params: { sessionId: "sess_1" } });

      await StripeController.retrieveCheckoutSession(req, res);

      expect(mockedStripe.retrieveCheckoutSession).toHaveBeenCalledWith(
        "sess_1",
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: "sess_1" });
    });

    it("returns 400 when the service throws", async () => {
      mockedStripe.retrieveCheckoutSession.mockRejectedValue(
        new Error("session fail"),
      );
      const req = buildReq({ params: { sessionId: "sess_1" } });

      await StripeController.retrieveCheckoutSession(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "session fail" });
    });

    it("falls back to 'Unknown error' for a non-Error rejection", async () => {
      mockedStripe.retrieveCheckoutSession.mockRejectedValue({ code: 1 });
      const req = buildReq({ params: { sessionId: "sess_1" } });

      await StripeController.retrieveCheckoutSession(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Unknown error" });
    });
  });

  describe("createOnboardingLink", () => {
    it("returns 200 with the onboarding link", async () => {
      mockedStripe.createOnboardingLink.mockResolvedValue({
        url: "https://onboard",
      });
      const req = buildReq({ params: { organisationId: "org_ob" } });

      await StripeController.createOnboardingLink(req, res);

      expect(mockedStripe.createOnboardingLink).toHaveBeenCalledWith("org_ob");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ url: "https://onboard" });
    });

    it("returns 400 when the service throws", async () => {
      mockedStripe.createOnboardingLink.mockRejectedValue(
        new Error("onboard fail"),
      );
      const req = buildReq({ params: { organisationId: "org_ob" } });

      await StripeController.createOnboardingLink(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "onboard fail" });
    });

    it("falls back to 'Unknown error' for a non-Error rejection", async () => {
      mockedStripe.createOnboardingLink.mockRejectedValue(["array"]);
      const req = buildReq({ params: { organisationId: "org_ob" } });

      await StripeController.createOnboardingLink(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Unknown error" });
    });
  });
});
