import type { Request } from "express";

const requireWebAuth = jest.fn((_req, _res, next) => next());
const requireMobileAuth = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));

const MerckController = { searchManuals: jest.fn() };
const MerckMobileController = { searchManuals: jest.fn() };

type RateLimitOptions = { keyGenerator: (req: Request) => string };
const rateLimitOptions: RateLimitOptions[] = [];

jest.mock("express-rate-limit", () => ({
  __esModule: true,
  default: jest.fn((options: RateLimitOptions) => {
    rateLimitOptions.push(options);
    return jest.fn((_req, _res, next) => next());
  }),
}));

jest.mock("../../src/middlewares/auth", () => ({
  requireWebAuth,
  requireMobileAuth,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions,
  requirePermission,
}));

jest.mock("../../src/controllers/web/merck.controller", () => ({
  MerckController,
}));

jest.mock("../../src/controllers/app/merck.controller", () => ({
  MerckMobileController,
}));

jest.requireActual("../../src/routers/knowledge.router");

const buildRequest = (req: Partial<Request>) =>
  ({ params: {}, headers: {}, ...req }) as Request;

describe("knowledge.router merck search limiter", () => {
  const keyGenerator = rateLimitOptions[0].keyGenerator;

  it("registers a single limiter for both merck search routes", () => {
    expect(rateLimitOptions).toHaveLength(1);
  });

  it("keys the limiter on the session-verified user", () => {
    const key = keyGenerator(
      buildRequest({ userId: "user-1" } as Partial<Request>),
    );

    expect(key).toBe("user-1");
  });

  it("ignores a client-supplied x-org-id header", () => {
    // The limiter fronts shared Merck credentials. If a caller-controlled header fed
    // the key, one valid token could rotate the header and mint an unlimited number of
    // fresh buckets — the mobile route has no :organisationId to fall back on.
    const base = { userId: "user-1" } as Partial<Request>;

    const keyA = keyGenerator(
      buildRequest({ ...base, headers: { "x-org-id": "org-a" } }),
    );
    const keyB = keyGenerator(
      buildRequest({ ...base, headers: { "x-org-id": "org-b" } }),
    );

    expect(keyA).toBe(keyB);
  });

  it("ignores a caller-supplied x-user-id header", () => {
    const key = keyGenerator(
      buildRequest({
        userId: "user-1",
        headers: { "x-user-id": "someone-else" },
      } as Partial<Request>),
    );

    expect(key).toBe("user-1");
  });

  it("does not let the organisation route param widen a user's budget", () => {
    const base = { userId: "user-1" } as Partial<Request>;

    const keyA = keyGenerator(
      buildRequest({ ...base, params: { organisationId: "org-a" } }),
    );
    const keyB = keyGenerator(
      buildRequest({ ...base, params: { organisationId: "org-b" } }),
    );

    expect(keyA).toBe(keyB);
  });

  it("shares one bucket when no verified user is present", () => {
    expect(keyGenerator(buildRequest({}))).toBe("unknown-user");
  });
});
