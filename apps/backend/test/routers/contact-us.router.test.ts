import type { Router } from "express";

const requireAnyAuth = jest.fn((_req, _res, next) => next());
const requireMobileAuth = jest.fn((_req, _res, next) => next());
const requireSuperAdmin = jest.fn((_req, _res, next) => next());
const publicContactLimiter = jest.fn((_req, _res, next) => next());

const ContactController = {
  create: jest.fn(),
  createWeb: jest.fn(),
  getAttachmentUploadUrl: jest.fn(),
  list: jest.fn(),
  getById: jest.fn(),
  updateStatus: jest.fn(),
};

const rateLimit = jest.fn(() => publicContactLimiter);

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
