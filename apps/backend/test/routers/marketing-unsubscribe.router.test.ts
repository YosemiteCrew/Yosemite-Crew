import type { Router } from "express";

const unsubscribe = jest.fn();

jest.mock("../../src/controllers/app/marketing-unsubscribe.controller", () => ({
  MarketingUnsubscribeController: { unsubscribe },
}));

const router = jest.requireActual(
  "../../src/routers/marketing-unsubscribe.router",
).default as Router;

describe("marketing-unsubscribe.router", () => {
  it.each(["get", "post"])("exposes the public %s endpoint", (method) => {
    const route = (router as any).stack.find(
      (layer: any) =>
        layer.route?.path === "/unsubscribe" &&
        Boolean(layer.route.methods[method]),
    );
    expect(route).toBeDefined();
    expect(route.route.stack[0].handle).toBe(unsubscribe);
  });
});
