import type { Router } from "express";

const attachSessionIfPresent = jest.fn((_req, _res, next) => next());
const consentLimiter = jest.fn((_req, _res, next) => next());

const ConsentController = {
  reportWebDecision: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  attachSessionIfPresent,
}));

jest.mock("express-rate-limit", () => jest.fn(() => consentLimiter));

jest.mock("../../src/controllers/app/consent.controller", () => ({
  ConsentController,
}));

const consentRouter = jest.requireActual("../../src/routers/consent.router")
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
    (consentRouter as unknown as { stack: Layer[] }).stack ?? []
  ).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  );
  return layer?.route;
};

describe("consent.router", () => {
  it("mounts the public consent report route", () => {
    const route = findRoute("/", "post");
    expect(route).toBeDefined();
    expect(route?.stack.map((layer) => layer.handle)).toContain(
      ConsentController.reportWebDecision,
    );
  });

  it("rate limits the anonymous route", () => {
    const route = findRoute("/", "post");
    expect(route?.stack.map((layer) => layer.handle)).toContain(consentLimiter);
  });

  it("attaches the session when present without rejecting anonymous callers", () => {
    // attachSessionIfPresent is the optional-session middleware: it never
    // rejects. Order before the controller so identity is bound for enrichment.
    const route = findRoute("/", "post");
    const handles = route?.stack.map((layer) => layer.handle) ?? [];
    expect(handles).toContain(attachSessionIfPresent);
    expect(handles.indexOf(attachSessionIfPresent)).toBeLessThan(
      handles.indexOf(ConsentController.reportWebDecision),
    );
  });
});
