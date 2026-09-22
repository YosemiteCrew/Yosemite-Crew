import type { Router } from "express";

const requireAnyAuth = jest.fn((_req, _res, next) => next());
const requireMobileAuth = jest.fn((_req, _res, next) => next());
const requireSuperAdmin = jest.fn((_req, _res, next) => next());
const publicContactLimiter = jest.fn((_req, _res, next) => next());
const globalBurstLimiter = jest.fn((_req, _res, next) => next());

const ContactController = {
  create: jest.fn(),
  createWeb: jest.fn(),
  getAttachmentUploadUrl: jest.fn(),
  list: jest.fn(),
  getById: jest.fn(),
  updateStatus: jest.fn(),
};

/* Hands back a DIFFERENT middleware for the global limiter, so a test can prove
   the route carries both rather than the same one twice. */
const rateLimit = jest.fn((options: { keyGenerator?: unknown }) =>
  typeof options?.keyGenerator === "function"
    ? globalBurstLimiter
    : publicContactLimiter,
);

jest.mock("../../src/middlewares/auth", () => ({
  requireAnyAuth,
  requireMobileAuth,
}));

jest.mock("../../src/middlewares/super-admin", () => ({
  requireSuperAdmin,
}));

jest.mock("express-rate-limit", () => rateLimit);

jest.mock("../../src/controllers/app/contact-us.controller", () => ({
  ContactController,
}));

const contactRouter = jest.requireActual("../../src/routers/contact-us.router")
  .default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const findRoute = (path: string, method: string) => {
  const layer = (
    (contactRouter as unknown as { stack: Layer[] }).stack ?? []
  ).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  );

  return layer?.route;
};

describe("contact-us.router", () => {
  it("configures a tighter budget than the global 500/15min limiter", () => {
    expect(rateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ windowMs: 15 * 60 * 1000, max: 10 }),
    );
  });

  it("adds a global burst budget the per-IP limiter cannot provide", () => {
    /* The per-IP limiter is blind to a distributed run: ~1,330 bot submissions
       arrived from 516 distinct IPs over nine days and no single IP came close
       to 10 in 15 minutes (#2645). A constant keyGenerator puts every caller on
       one shared counter. */
    const globalCall = rateLimit.mock.calls.find(
      ([options]: [{ keyGenerator?: unknown }]) =>
        typeof options?.keyGenerator === "function",
    );
    expect(globalCall).toBeDefined();
    const options = globalCall![0] as {
      max: number;
      windowMs: number;
      keyGenerator: (req: unknown) => string;
    };
    expect(options.windowMs).toBe(15 * 60 * 1000);
    expect(options.max).toBe(60);
    // The same key whoever asks - otherwise it is just a second per-IP limiter.
    expect(options.keyGenerator({ ip: "1.1.1.1" })).toBe(
      options.keyGenerator({ ip: "2.2.2.2" }),
    );
  });

  it("puts the global burst limiter on the public contact route", () => {
    const webContactRoute = findRoute("/contact-web", "post");
    // Two distinct limiter layers, not one reused: per-IP and global together.
    const handles = webContactRoute?.stack.map((layer) => layer.handle) ?? [];
    expect(handles).toContain(publicContactLimiter);
    expect(handles).toContain(globalBurstLimiter);
  });

  // These two routes are reachable without a session, so the dedicated limiter is the only
  // thing bounding an anonymous caller.
  it("rate limits the unauthenticated public contact routes", () => {
    const webContactRoute = findRoute("/contact-web", "post");
    const presignedRoute = findRoute("/attachments/presigned-url", "post");

    expect(webContactRoute?.stack.map((layer) => layer.handle)).toContain(
      publicContactLimiter,
    );
    expect(presignedRoute?.stack.map((layer) => layer.handle)).toContain(
      publicContactLimiter,
    );
  });

  it("keeps auth on the mobile route", () => {
    expect(findRoute("/contact", "post")?.stack.map((l) => l.handle)).toContain(
      requireMobileAuth,
    );
  });

  // The /requests queue holds submissions from the PUBLIC contact form - names,
  // emails, phone numbers - belonging to people with no relationship to any
  // practice. It is operator data, not tenant data, so a plain staff session is
  // not enough. The gate lives on a `router.use` prefix rather than per-route so
  // a future /requests route cannot be added without it.
  it("gates the whole support queue behind super-admin", () => {
    const gate = (
      contactRouter as unknown as {
        stack: Array<{ route?: unknown; handle: unknown; regexp: RegExp }>;
      }
    ).stack.filter((layer) => !layer.route);

    const handlers = gate.map((layer) => layer.handle);
    expect(handlers).toContain(requireAnyAuth);
    expect(handlers).toContain(requireSuperAdmin);

    for (const layer of gate) {
      if (
        layer.handle === requireSuperAdmin ||
        layer.handle === requireAnyAuth
      ) {
        expect(layer.regexp.test("/requests")).toBe(true);
        expect(layer.regexp.test("/contact-web")).toBe(false);
      }
    }
  });
});
