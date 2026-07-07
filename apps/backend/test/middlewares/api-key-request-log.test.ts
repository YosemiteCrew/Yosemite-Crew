import { EventEmitter } from "node:events";
import type { NextFunction, Request, Response } from "express";
import { captureApiKeyRequestLog } from "../../src/middlewares/api-key-request-log";
import { DeveloperRequestLogService } from "../../src/services/developer-request-log.service";
import logger from "../../src/utils/logger";

jest.mock("../../src/services/developer-request-log.service", () => ({
  DeveloperRequestLogService: { record: jest.fn() },
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn() },
}));

const recordMock = DeveloperRequestLogService.record as jest.Mock;
const loggerErrorMock = logger.error as jest.Mock;

type TestRes = Response & EventEmitter & { statusCode: number };

const buildRes = (): TestRes => {
  const emitter = new EventEmitter() as unknown as TestRes;
  emitter.statusCode = 200;
  (emitter as { json: unknown }).json = jest
    .fn()
    .mockImplementation(() => emitter);
  return emitter;
};

const apiKey = {
  id: "key-1",
  organisationId: "org-1",
  scopes: ["appointments:read"],
  environment: "live",
  ipAllowlist: [],
};

const buildReq = (overrides: Partial<Request> = {}): Request =>
  ({
    method: "GET",
    baseUrl: "/v1/developer",
    path: "/appointments/abc",
    route: { path: "/appointments/:id" },
    apiKey,
    ...overrides,
  }) as unknown as Request;

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("captureApiKeyRequestLog", () => {
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    recordMock.mockResolvedValue(undefined);
    next = jest.fn();
  });

  it("always calls next synchronously", () => {
    captureApiKeyRequestLog(buildReq(), buildRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(recordMock).not.toHaveBeenCalled();
  });

  it("records the matched route pattern (never the raw id) on finish", async () => {
    const req = buildReq();
    const res = buildRes();
    captureApiKeyRequestLog(req, res, next);

    res.statusCode = 200;
    res.emit("finish");
    await flush();

    expect(recordMock).toHaveBeenCalledTimes(1);
    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        apiKeyId: "key-1",
        method: "GET",
        path: "/v1/developer/appointments/:id",
        statusCode: 200,
        errorCode: null,
        environment: "live",
      }),
    );
    expect(recordMock.mock.calls[0][0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it("falls back to req.path when no route matched (router-level rejections)", async () => {
    const req = buildReq({ route: undefined, path: "/appointments" } as never);
    const res = buildRes();
    captureApiKeyRequestLog(req, res, next);

    res.statusCode = 429;
    res.emit("finish");
    await flush();

    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/v1/developer/appointments" }),
    );
  });

  it("captures the error code from the { message, code } envelope on 4xx", async () => {
    const req = buildReq();
    const res = buildRes();
    captureApiKeyRequestLog(req, res, next);

    res.statusCode = 429;
    res.json({
      message: "Rate limit exceeded for this API key.",
      code: "rate_limited",
    });
    res.emit("finish");
    await flush();

    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 429, errorCode: "rate_limited" }),
    );
  });

  it("does not treat a 2xx body's code field as an error code", async () => {
    const req = buildReq();
    const res = buildRes();
    captureApiKeyRequestLog(req, res, next);

    res.json({ data: [], code: "not_an_error" });
    res.emit("finish");
    await flush();

    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 200, errorCode: null }),
    );
  });

  it("skips requests with no verified key (nothing to attribute)", async () => {
    const req = buildReq({ apiKey: undefined } as never);
    const res = buildRes();
    captureApiKeyRequestLog(req, res, next);

    res.statusCode = 401;
    res.emit("finish");
    await flush();

    expect(recordMock).not.toHaveBeenCalled();
  });

  it("swallows and logs persistence failures without touching the response", async () => {
    recordMock.mockRejectedValue(new Error("db down"));
    const req = buildReq();
    const res = buildRes();
    captureApiKeyRequestLog(req, res, next);

    res.emit("finish");
    await flush();

    expect(loggerErrorMock).toHaveBeenCalledWith(
      "Failed to record developer API request log",
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });

  it("normalizes a root route path to the bare mount path", async () => {
    const req = buildReq({
      route: { path: "/" },
      path: "/",
    } as never);
    const res = buildRes();
    captureApiKeyRequestLog(req, res, next);

    res.emit("finish");
    await flush();

    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/v1/developer" }),
    );
  });
});
