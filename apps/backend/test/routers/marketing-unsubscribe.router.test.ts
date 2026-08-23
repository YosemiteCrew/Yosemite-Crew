import type { Router } from "express";

const confirm = jest.fn();
const unsubscribe = jest.fn();

jest.mock("../../src/controllers/app/marketing-unsubscribe.controller", () => ({
  MarketingUnsubscribeController: { confirm, unsubscribe },
}));

const router = jest.requireActual(
  "../../src/routers/marketing-unsubscribe.router",
).default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: { handle: unknown }[];
  };
};

const handlerFor = (method: string) => {
  const layer = (router as unknown as { stack: Layer[] }).stack.find(
    (l) => l.route?.path === "/unsubscribe" && Boolean(l.route.methods[method]),
  );
  expect(layer).toBeDefined();
  return layer!.route!.stack[0].handle;
};

describe("marketing-unsubscribe.router", () => {
  it("routes GET to the read-only confirmation handler", () => {
    // The split is the security property: a mutating GET would let a mail
    // scanner's prefetch unsubscribe the recipient.
    expect(handlerFor("get")).toBe(confirm);
  });

  it("routes POST to the handler that performs the unsubscribe", () => {
    expect(handlerFor("post")).toBe(unsubscribe);
  });

  it("does not route GET to the mutating handler", () => {
    expect(handlerFor("get")).not.toBe(unsubscribe);
  });
});
