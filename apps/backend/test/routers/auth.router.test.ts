import type { Router, Request, Response } from "express";

const requireAuth = jest.fn(
  () => (_req: Request, _res: Response, next: () => void) => next(),
);
const requireAnyAuth = jest.fn(
  (_req: Request, _res: Response, next: () => void) => next(),
);
const mockSignOut = jest.fn();
const mockGetUserRoles = jest.fn();
let mockService: {
  signOut: typeof mockSignOut;
  getUserRoles: typeof mockGetUserRoles;
} | null = {
  signOut: mockSignOut,
  getUserRoles: mockGetUserRoles,
};

jest.mock("@yosemite-crew/auth", () => ({
  requireAuth,
  getAuthService: () => mockService,
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("../../src/middlewares/auth", () => ({
  requireAnyAuth,
}));

const MfaController = {
  status: jest.fn(),
  enableTotp: jest.fn(),
  disableTotp: jest.fn(),
};
const MfaDebugController = { createTotpDevice: jest.fn() };
jest.mock("../../src/controllers/web/mfa.controller", () => ({
  MfaController,
}));
jest.mock("../../src/controllers/web/mfa-debug.controller", () => ({
  MfaDebugController,
}));

// The debug route is gated on the explicit local-development flag, and the
// router evaluates that gate at import time, so it has to be set before the
// module is required for the baseline suite below.
process.env.LOCAL_DEVELOPMENT = "true";

const authRouter = jest.requireActual("../../src/routers/auth.router")
  .default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: (...args: unknown[]) => unknown }>;
  };
  handle?: (...args: unknown[]) => unknown;
  name?: string;
};

const layers = () => (authRouter as unknown as { stack: Layer[] }).stack ?? [];

const handlerFor = (path: string, method: "get" | "post") => {
  const route = layers().find(
    (l) => l.route?.path === path && Boolean(l.route?.methods?.[method]),
  )?.route;
  return route?.stack.at(-1)?.handle;
};

const makeRes = () => {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

describe("auth.router", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockService = { signOut: mockSignOut, getUserRoles: mockGetUserRoles };
  });

  it("exposes the normalized /me and /logout routes", () => {
    expect(handlerFor("/me", "get")).toBeDefined();
    expect(handlerFor("/logout", "post")).toBeDefined();
  });

  it("returns 503 from the guard when the auth service is disabled", () => {
    mockService = null;
    const guard = layers().find((l) => l.name === "<anonymous>" && l.handle)
      ?.handle as (req: Request, res: Response, next: () => void) => void;
    const res = makeRes();
    const next = jest.fn();
    guard({} as Request, res as unknown as Response, next);
    expect(res.statusCode).toBe(503);
    expect(next).not.toHaveBeenCalled();
  });

  it("lets the guard through when the auth service is enabled", () => {
    const guard = layers().find((l) => l.name === "<anonymous>" && l.handle)
      ?.handle as (req: Request, res: Response, next: () => void) => void;
    const res = makeRes();
    const next = jest.fn();
    guard({} as Request, res as unknown as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it("serves the normalized session on GET /me", async () => {
    const handler = handlerFor("/me", "get") as (
      req: Request,
      res: Response,
    ) => Promise<void> | void;
    const res = makeRes();
    const session = {
      appUserId: "u1",
      providerUserId: "st-user-1",
      authProfile: "pims_web",
      loginMethod: "emailpassword",
      email: "vet@clinic.test",
      emailVerified: true,
      mfa: { required: true, completed: true, completedFactors: ["totp"] },
      firstName: "Ada",
      lastName: "Vet",
      roles: ["superadmin"],
    };
    mockGetUserRoles.mockResolvedValueOnce([]);
    await handler(
      { authSession: session } as unknown as Request,
      res as unknown as Response,
    );
    expect(res.body).toMatchObject({
      userId: "u1",
      authProfile: "pims_web",
      email: "vet@clinic.test",
      emailVerified: true,
      role: "superadmin",
    });
    expect(mockGetUserRoles).toHaveBeenCalledWith("st-user-1");
  });

  it("revokes the session on POST /logout", async () => {
    mockSignOut.mockResolvedValueOnce(undefined);
    const handler = handlerFor("/logout", "post") as (
      req: Request,
      res: Response,
      next: (e?: unknown) => void,
    ) => Promise<void>;
    const res = makeRes();
    const next = jest.fn();
    await handler({} as Request, res as unknown as Response, next);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: "OK" });
  });

  it("forwards logout errors to next", async () => {
    const boom = new Error("revoke failed");
    mockSignOut.mockRejectedValueOnce(boom);
    const handler = handlerFor("/logout", "post") as (
      req: Request,
      res: Response,
      next: (e?: unknown) => void,
    ) => Promise<void>;
    const res = makeRes();
    const next = jest.fn();
    await handler({} as Request, res as unknown as Response, next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it("delegates the MFA routes to their controllers", () => {
    const req = {} as Request;
    const res = makeRes() as unknown as Response;
    (handlerFor("/mfa/status", "get") as (r: Request, s: Response) => void)(
      req,
      res,
    );
    expect(MfaController.status).toHaveBeenCalled();
    (
      handlerFor("/mfa/totp/enable", "post") as (
        r: Request,
        s: Response,
      ) => void
    )(req, res);
    expect(MfaController.enableTotp).toHaveBeenCalled();
    (
      handlerFor("/mfa/totp/disable", "post") as (
        r: Request,
        s: Response,
      ) => void
    )(req, res);
    expect(MfaController.disableTotp).toHaveBeenCalled();
    (
      handlerFor("/mfa/totp/debug/create-device", "post") as (
        r: Request,
        s: Response,
      ) => void
    )(req, res);
    expect(MfaDebugController.createTotpDevice).toHaveBeenCalled();
  });

  describe("MFA debug route gating", () => {
    const originalFlag = process.env.LOCAL_DEVELOPMENT;
    const originalNodeEnv = process.env.NODE_ENV;

    const loadRouter = (
      flag: string | undefined,
      nodeEnv: string | undefined,
      assert: (stack: Layer[]) => void,
    ) => {
      if (flag === undefined) delete process.env.LOCAL_DEVELOPMENT;
      else process.env.LOCAL_DEVELOPMENT = flag;
      if (nodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = nodeEnv;

      try {
        jest.isolateModules(() => {
          const gated = jest.requireActual("../../src/routers/auth.router")
            .default as Router;
          assert((gated as unknown as { stack: Layer[] }).stack ?? []);
        });
      } finally {
        process.env.LOCAL_DEVELOPMENT = originalFlag;
        process.env.NODE_ENV = originalNodeEnv;
      }
    };

    const debugRoute = (stack: Layer[]) =>
      stack.find((l) => l.route?.path === "/mfa/totp/debug/create-device");

    // NODE_ENV alone must never mount the debug route. A deployed dev or
    // staging tier commonly runs NODE_ENV=development while being a real remote
    // environment, and it will not set the local-development flag.
    it.each([
      ["no flag, NODE_ENV=development", undefined, "development"],
      ["no flag, NODE_ENV=test", undefined, "test"],
      ["no flag, NODE_ENV unset", undefined, undefined],
      ["no flag, NODE_ENV=staging", undefined, "staging"],
      ["flag=false", "false", "development"],
      ["flag empty", "", "development"],
      ["flag set in production", "true", "production"],
    ])("does not register the debug route with %s", (_label, flag, nodeEnv) => {
      loadRouter(flag, nodeEnv, (stack) => {
        expect(debugRoute(stack)).toBeUndefined();
        // Only the debug endpoint is withheld; the rest of the router stands.
        expect(
          stack.find((l) => l.route?.path === "/mfa/totp/disable"),
        ).toBeDefined();
      });
    });

    // A genuine local run is driven by the documented flag, whatever NODE_ENV
    // happens to be.
    it.each([
      ["NODE_ENV=development", "development"],
      ["NODE_ENV=test", "test"],
      ["NODE_ENV unset", undefined],
    ])("registers the debug route with the flag and %s", (_label, nodeEnv) => {
      loadRouter("true", nodeEnv, (stack) => {
        expect(debugRoute(stack)).toBeDefined();
      });
    });
  });
});
