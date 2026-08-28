import type { Request, Response } from "express";
import { DeveloperBillingController } from "../../../src/controllers/web/developer-billing.controller";
import {
  DeveloperBillingService,
  DeveloperBillingServiceError,
} from "../../../src/services/developer-billing.service";

jest.mock("../../../src/services/developer-billing.service", () => {
  class Err extends Error {
    constructor(
      message: string,
      public statusCode: number,
    ) {
      super(message);
    }
  }
  return {
    DeveloperBillingService: {
      getSubscription: jest.fn(),
      createCheckoutSession: jest.fn(),
      createPortalSession: jest.fn(),
      handleWebhookEvent: jest.fn(),
      verifyWebhook: jest.fn(),
    },
    DeveloperBillingServiceError: Err,
  };
});

jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn() },
}));

const svc = DeveloperBillingService as unknown as {
  getSubscription: jest.Mock;
  createCheckoutSession: jest.Mock;
  createPortalSession: jest.Mock;
  handleWebhookEvent: jest.Mock;
  verifyWebhook: jest.Mock;
};

const buildRes = (): Response => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res as Response;
};

const buildReq = (
  over: {
    organisationId?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Request =>
  ({
    body: over.body ?? {},
    params: {},
    headers: over.headers ?? {},
    organisationId: over.organisationId,
  }) as unknown as Request;

describe("DeveloperBillingController.getSubscription", () => {
  beforeEach(() => jest.clearAllMocks());

  it("400 without organisationId", async () => {
    const res = buildRes();
    await DeveloperBillingController.getSubscription(buildReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("200 with data envelope", async () => {
    svc.getSubscription.mockResolvedValue({ id: "s", plan: "free" });
    const res = buildRes();
    await DeveloperBillingController.getSubscription(
      buildReq({ organisationId: "o" }),
      res,
    );
    expect(res.json).toHaveBeenCalledWith({ data: { id: "s", plan: "free" } });
  });

  it("500 on unexpected error", async () => {
    svc.getSubscription.mockRejectedValue(new Error("boom"));
    const res = buildRes();
    await DeveloperBillingController.getSubscription(
      buildReq({ organisationId: "o" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("DeveloperBillingController.createCheckout", () => {
  beforeEach(() => jest.clearAllMocks());

  it("400 without organisationId", async () => {
    const res = buildRes();
    await DeveloperBillingController.createCheckout(buildReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("400 when successUrl is missing", async () => {
    const res = buildRes();
    await DeveloperBillingController.createCheckout(
      buildReq({
        organisationId: "o",
        body: { cancelUrl: "https://b.com" },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(svc.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("400 when successUrl is not a valid URL", async () => {
    const res = buildRes();
    await DeveloperBillingController.createCheckout(
      buildReq({
        organisationId: "o",
        body: { successUrl: "not-a-url", cancelUrl: "https://b.com" },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("201 with checkout URL", async () => {
    svc.createCheckoutSession.mockResolvedValue(
      "https://checkout.stripe.com/x",
    );
    const res = buildRes();
    await DeveloperBillingController.createCheckout(
      buildReq({
        organisationId: "o",
        body: {
          successUrl: "https://app.com/success",
          cancelUrl: "https://app.com/cancel",
        },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      data: { url: "https://checkout.stripe.com/x" },
    });
  });

  it("maps service error to its status code", async () => {
    svc.createCheckoutSession.mockRejectedValue(
      new DeveloperBillingServiceError("not configured", 500),
    );
    const res = buildRes();
    await DeveloperBillingController.createCheckout(
      buildReq({
        organisationId: "o",
        body: {
          successUrl: "https://app.com/success",
          cancelUrl: "https://app.com/cancel",
        },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("DeveloperBillingController.createPortal", () => {
  beforeEach(() => jest.clearAllMocks());

  it("400 without organisationId", async () => {
    const res = buildRes();
    await DeveloperBillingController.createPortal(buildReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("400 without returnUrl", async () => {
    const res = buildRes();
    await DeveloperBillingController.createPortal(
      buildReq({ organisationId: "o", body: {} }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("201 with portal URL", async () => {
    svc.createPortalSession.mockResolvedValue("https://billing.stripe.com/p");
    const res = buildRes();
    await DeveloperBillingController.createPortal(
      buildReq({
        organisationId: "o",
        body: { returnUrl: "https://app.com/billing" },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      data: { url: "https://billing.stripe.com/p" },
    });
  });

  it("404 maps not-found service error", async () => {
    svc.createPortalSession.mockRejectedValue(
      new DeveloperBillingServiceError("No billing account", 404),
    );
    const res = buildRes();
    await DeveloperBillingController.createPortal(
      buildReq({
        organisationId: "o",
        body: { returnUrl: "https://app.com/billing" },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("DeveloperBillingController.webhook", () => {
  beforeEach(() => jest.clearAllMocks());

  it("400 when stripe-signature header is missing", async () => {
    const res = buildRes();
    await DeveloperBillingController.webhook(
      buildReq({ body: Buffer.from("x") }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(svc.verifyWebhook).not.toHaveBeenCalled();
  });

  it("400 when signature verification fails", async () => {
    svc.verifyWebhook.mockImplementation(() => {
      throw new Error("invalid");
    });
    const res = buildRes();
    await DeveloperBillingController.webhook(
      buildReq({
        body: Buffer.from("x"),
        headers: { "stripe-signature": "sig" },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(svc.handleWebhookEvent).not.toHaveBeenCalled();
  });

  it("200 on successful event processing", async () => {
    const fakeEvent = { type: "checkout.session.completed" };
    svc.verifyWebhook.mockReturnValue(fakeEvent);
    svc.handleWebhookEvent.mockResolvedValue(undefined);

    const res = buildRes();
    await DeveloperBillingController.webhook(
      buildReq({
        body: Buffer.from("x"),
        headers: { "stripe-signature": "sig" },
      }),
      res,
    );
    expect(svc.handleWebhookEvent).toHaveBeenCalledWith(fakeEvent);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it("500 when handler throws", async () => {
    const fakeEvent = { type: "some.event" };
    svc.verifyWebhook.mockReturnValue(fakeEvent);
    svc.handleWebhookEvent.mockRejectedValue(new Error("handler failed"));

    const res = buildRes();
    await DeveloperBillingController.webhook(
      buildReq({
        body: Buffer.from("x"),
        headers: { "stripe-signature": "sig" },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
