import type { Request, Response, NextFunction } from "express";

const controller: Record<string, jest.Mock> = {
  webfinger: jest.fn().mockResolvedValue(undefined),
  hostMeta: jest.fn(),
  nodeInfoIndex: jest.fn(),
};

jest.mock("src/controllers/web/activitypub.controller", () => ({
  WellKnownController: controller,
}));

const errorLog = jest.fn();
jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: errorLog, warn: jest.fn() },
}));

import router from "src/routers/well-known.router";

type CapturedRes = {
  statusCode?: number;
  body?: unknown;
  headersSent: boolean;
  status: (c: number) => CapturedRes;
  json: (p: unknown) => CapturedRes;
  end: () => CapturedRes;
};

function makeRes(): CapturedRes {
  const res: CapturedRes = {
    headersSent: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      this.headersSent = true;
      return this;
    },
    end() {
      this.headersSent = true;
      return this;
    },
  };
  return res;
}

function dispatch(method: string, url: string) {
  return new Promise<CapturedRes>((resolve) => {
    const res = makeRes();
    const req = {
      method,
      url,
      originalUrl: url,
      params: {},
      query: {},
      body: {},
      headers: {},
    } as unknown as Request;
    const done = () => resolve(res);
    (router as unknown as (r: Request, s: Response, n: NextFunction) => void)(
      req,
      res as unknown as Response,
      done as NextFunction,
    );
    setImmediate(() => resolve(res));
  });
}

describe("well-known.router AP_ENABLED gate", () => {
  afterEach(() => {
    delete process.env.AP_ENABLED;
    jest.clearAllMocks();
    controller.webfinger.mockResolvedValue(undefined);
  });

  it("webfinger 404 when disabled (fail-closed)", async () => {
    const res = await dispatch("GET", "/webfinger");
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      error: "Federation is disabled on this instance",
    });
    expect(controller.webfinger).not.toHaveBeenCalled();
  });

  it("nodeinfo 404 when disabled", async () => {
    const res = await dispatch("GET", "/nodeinfo");
    expect(res.statusCode).toBe(404);
    expect(controller.nodeInfoIndex).not.toHaveBeenCalled();
  });

  it("host-meta is reachable even when disabled (no gate)", async () => {
    await dispatch("GET", "/host-meta");
    expect(controller.hostMeta).toHaveBeenCalledTimes(1);
  });
});

describe("well-known.router when AP_ENABLED=true", () => {
  beforeEach(() => {
    process.env.AP_ENABLED = "true";
  });
  afterEach(() => {
    delete process.env.AP_ENABLED;
    jest.clearAllMocks();
    controller.webfinger.mockResolvedValue(undefined);
  });

  it("dispatches webfinger", async () => {
    await dispatch("GET", "/webfinger");
    expect(controller.webfinger).toHaveBeenCalledTimes(1);
  });

  it("dispatches nodeinfo index", async () => {
    await dispatch("GET", "/nodeinfo");
    expect(controller.nodeInfoIndex).toHaveBeenCalledTimes(1);
  });

  it("async wrapper catches a rejected webfinger handler and 500s", async () => {
    controller.webfinger.mockRejectedValue(new Error("boom"));
    const res = await dispatch("GET", "/webfinger");
    await new Promise((r) => setImmediate(r));
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "Internal error" });
    expect(errorLog).toHaveBeenCalled();
  });
});
