import type { Router, Request, Response } from "express";

const requireAuth = jest.fn(
  () => (_req: Request, _res: Response, next: () => void) => next(),
);
const requireAnyAuth = jest.fn(
  (_req: Request, _res: Response, next: () => void) => next(),
);
const mockSignOut = jest.fn();
let mockService: { signOut: typeof mockSignOut } | null = {
  signOut: mockSignOut,
};

jest.mock("@yosemite-crew/auth", () => ({
  requireAuth,
  getAuthService: () => mockService,
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
    mockService = { signOut: mockSignOut };
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

  it("serves the normalized session on GET /me", () => {
    const handler = handlerFor("/me", "get") as (
      req: Request,
      res: Response,
    ) => void;
    const res = makeRes();
    const session = {
      appUserId: "u1",
      authProfile: "pims_web",
      loginMethod: "emailpassword",
      email: "vet@clinic.test",
      emailVerified: true,
      mfa: { required: true, completed: true, completedFactors: ["totp"] },
      firstName: "Ada",
      lastName: "Vet",
      role: "member",
    };
    handler(
      { authSession: session } as unknown as Request,
      res as unknown as Response,
    );
    expect(res.body).toMatchObject({
      userId: "u1",
      authProfile: "pims_web",
      email: "vet@clinic.test",
      emailVerified: true,
    });
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
});
