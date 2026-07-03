import type { Request, Response, NextFunction } from "express";

// Controller handlers are stubbed to observe which one the router dispatches to,
// and to let us drive the async-wrapper error branch.
const controller: Record<string, jest.Mock> = {};
const HANDLER_NAMES = [
  "getActor",
  "postInbox",
  "getOutbox",
  "getFollowers",
  "getFollowing",
  "postSharedInbox",
  "getActorSettings",
  "follow",
  "unfollow",
  "approveFollower",
  "rejectFollower",
  "listFollowers",
  "listFollowing",
  "sendReferral",
  "listInboundReferrals",
  "listOutboundReferrals",
  "updateLicenseToken",
  "respondToReferral",
  "updateActorProfile",
  "sendNote",
  "announceEmergency",
  "toggleDirectoryListing",
  "getDirectory",
];
for (const n of HANDLER_NAMES)
  controller[n] = jest.fn().mockResolvedValue(undefined);

jest.mock("src/controllers/web/activitypub.controller", () => ({
  ActivityPubController: controller,
}));

// Auth + rbac middleware are pass-throughs so we can reach the manage handlers.
jest.mock("src/middlewares/auth", () => ({
  authorizeCognito: (_req: Request, _res: Response, next: NextFunction) =>
    next(),
}));
jest.mock("src/middlewares/rbac", () => ({
  withOrgPermissions:
    () => (_req: Request, _res: Response, next: NextFunction) =>
      next(),
}));

const errorLog = jest.fn();
jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: errorLog, warn: jest.fn() },
}));

import router from "src/routers/activitypub.router";

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

// Drive a request through the express Router's callable middleware interface.
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
    // If nothing handles it, express calls next(); resolve anyway.
    (router as unknown as (r: Request, s: Response, n: NextFunction) => void)(
      req,
      res as unknown as Response,
      done as NextFunction,
    );
    // Router dispatch is synchronous up to the handler; give async handlers a tick.
    setImmediate(() => resolve(res));
  });
}

describe("activitypub.router AP_ENABLED gate (fail-closed)", () => {
  afterEach(() => {
    delete process.env.AP_ENABLED;
    jest.clearAllMocks();
    for (const n of HANDLER_NAMES) controller[n].mockResolvedValue(undefined);
  });

  it("404 for a public route when AP_ENABLED is unset", async () => {
    const res = await dispatch("GET", "/organizations/org-1");
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      error: "Federation is disabled on this instance",
    });
    expect(controller.getActor).not.toHaveBeenCalled();
  });

  it('404 when AP_ENABLED is a non-"true" value', async () => {
    process.env.AP_ENABLED = "1";
    const res = await dispatch("GET", "/organizations/org-1");
    expect(res.statusCode).toBe(404);
    expect(controller.getActor).not.toHaveBeenCalled();
  });

  it("404 for a manage route when disabled", async () => {
    const res = await dispatch("GET", "/manage/actor");
    expect(res.statusCode).toBe(404);
    expect(controller.getActorSettings).not.toHaveBeenCalled();
  });
});

describe("activitypub.router dispatch when AP_ENABLED=true", () => {
  beforeEach(() => {
    process.env.AP_ENABLED = "true";
  });
  afterEach(() => {
    delete process.env.AP_ENABLED;
    jest.clearAllMocks();
    for (const n of HANDLER_NAMES) controller[n].mockResolvedValue(undefined);
  });

  it.each([
    ["GET", "/organizations/org-1", "getActor"],
    ["POST", "/organizations/org-1/inbox", "postInbox"],
    ["GET", "/organizations/org-1/outbox", "getOutbox"],
    ["GET", "/organizations/org-1/followers", "getFollowers"],
    ["GET", "/organizations/org-1/following", "getFollowing"],
    ["POST", "/shared-inbox", "postSharedInbox"],
    ["GET", "/manage/actor", "getActorSettings"],
    ["POST", "/manage/follow", "follow"],
    ["POST", "/manage/unfollow", "unfollow"],
    ["POST", "/manage/followers/approve", "approveFollower"],
    ["POST", "/manage/followers/reject", "rejectFollower"],
    ["GET", "/manage/followers", "listFollowers"],
    ["GET", "/manage/following", "listFollowing"],
    ["POST", "/manage/referrals", "sendReferral"],
    ["GET", "/manage/referrals/inbound", "listInboundReferrals"],
    ["GET", "/manage/referrals/outbound", "listOutboundReferrals"],
    ["PUT", "/manage/license-token", "updateLicenseToken"],
    ["PUT", "/manage/directory-listing", "toggleDirectoryListing"],
    ["GET", "/manage/directory", "getDirectory"],
    ["PATCH", "/manage/referrals/r1", "respondToReferral"],
    ["PUT", "/manage/actor", "updateActorProfile"],
    ["POST", "/manage/notes", "sendNote"],
    ["POST", "/manage/announce", "announceEmergency"],
  ])("%s %s → %s", async (method, url, handler) => {
    await dispatch(method, url);
    expect(controller[handler]).toHaveBeenCalledTimes(1);
  });

  it("async wrapper catches a rejected handler and 500s", async () => {
    controller.getActor.mockRejectedValue(new Error("boom"));
    const res = await dispatch("GET", "/organizations/org-1");
    // wait a tick for the rejected promise to settle in the .catch
    await new Promise((r) => setImmediate(r));
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "Internal error" });
    expect(errorLog).toHaveBeenCalled();
  });

  it("async wrapper does not double-respond when headers already sent", async () => {
    controller.getActor.mockImplementation((_req: Request, r: CapturedRes) => {
      r.status(200).json({ ok: true });
      return Promise.reject(new Error("late"));
    });
    const res = await dispatch("GET", "/organizations/org-1");
    await new Promise((r) => setImmediate(r));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
