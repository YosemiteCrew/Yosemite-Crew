import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { OpenStatusWebhookController } from "../../../src/controllers/web/openstatus.controller";
import { OpenStatusService } from "../../../src/services/openstatus.service";

jest.mock("../../../src/services/openstatus.service", () => {
  const actual = jest.requireActual(
    "../../../src/services/openstatus.service",
  ) as typeof import("../../../src/services/openstatus.service");
  return {
    ...actual,
    OpenStatusService: { handleMonitorEvent: jest.fn() },
  };
});

jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const mockedService = jest.mocked(OpenStatusService);

const SECRET = "top-secret";

const validPayload = {
  monitor: { id: 42, name: "API", url: "https://api.example.com" },
  cronTimestamp: 1_700_000_000,
  status: "error",
  statusCode: 503,
};

describe("OpenStatusWebhookController", () => {
  let req: Partial<Request>;
  let res: Response;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let endMock: jest.Mock;

  const buildReq = (
    body: unknown,
    secretHeader: string | null = SECRET,
  ): Partial<Request> => ({
    headers:
      secretHeader === null
        ? {}
        : { "x-openstatus-webhook-secret": secretHeader },
    body: Buffer.from(
      typeof body === "string" ? body : JSON.stringify(body),
      "utf8",
    ),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENSTATUS_WEBHOOK_SECRET = SECRET;

    jsonMock = jest.fn();
    endMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock, end: endMock });
    res = { status: statusMock, json: jsonMock, end: endMock } as unknown as Response;
  });

  it("returns 401 when the secret is not configured", async () => {
    delete process.env.OPENSTATUS_WEBHOOK_SECRET;
    req = buildReq(validPayload);

    await OpenStatusWebhookController.handle(req as Request, res);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(mockedService.handleMonitorEvent).not.toHaveBeenCalled();
  });

  it("returns 401 when the secret header is missing", async () => {
    req = buildReq(validPayload, null);

    await OpenStatusWebhookController.handle(req as Request, res);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(mockedService.handleMonitorEvent).not.toHaveBeenCalled();
  });

  it("returns 401 when the secret header is wrong", async () => {
    req = buildReq(validPayload, "wrong-secret");

    await OpenStatusWebhookController.handle(req as Request, res);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(mockedService.handleMonitorEvent).not.toHaveBeenCalled();
  });

  it("returns 400 when the body is not valid JSON", async () => {
    req = buildReq("{not-json");

    await OpenStatusWebhookController.handle(req as Request, res);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({ message: "Invalid JSON" });
  });

  it("returns 400 when the payload fails schema validation", async () => {
    req = buildReq({ monitor: { id: 1 }, status: "error" });

    await OpenStatusWebhookController.handle(req as Request, res);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({ message: "Invalid payload" });
    expect(mockedService.handleMonitorEvent).not.toHaveBeenCalled();
  });

  it("delegates to the service and returns 200 on a valid webhook", async () => {
    mockedService.handleMonitorEvent.mockResolvedValueOnce({ created: true });
    req = buildReq(validPayload);

    await OpenStatusWebhookController.handle(req as Request, res);

    expect(mockedService.handleMonitorEvent).toHaveBeenCalledTimes(1);
    expect(mockedService.handleMonitorEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "error", monitor: expect.any(Object) }),
    );
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ received: true });
  });

  it("accepts a secret header provided as an array", async () => {
    mockedService.handleMonitorEvent.mockResolvedValueOnce({ created: true });
    req = {
      headers: { "x-openstatus-webhook-secret": [SECRET] },
      body: Buffer.from(JSON.stringify(validPayload), "utf8"),
    };

    await OpenStatusWebhookController.handle(req as Request, res);

    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it("returns 500 when the service throws", async () => {
    mockedService.handleMonitorEvent.mockRejectedValueOnce(
      new Error("boom"),
    );
    req = buildReq(validPayload);

    await OpenStatusWebhookController.handle(req as Request, res);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({ error: "boom" });
  });

  it("returns 500 with a generic message when a non-Error is thrown", async () => {
    mockedService.handleMonitorEvent.mockRejectedValueOnce("weird");
    req = buildReq(validPayload);

    await OpenStatusWebhookController.handle(req as Request, res);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({ error: "Unknown error" });
  });
});
