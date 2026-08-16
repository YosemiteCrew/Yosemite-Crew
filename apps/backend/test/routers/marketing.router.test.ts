import type { Router } from "express";

const getDiscordMembers = jest.fn();

jest.mock("../../src/controllers/app/marketing.controller", () => ({
  MarketingController: { getDiscordMembers },
}));

const router = jest.requireActual("../../src/routers/marketing.router")
  .default as Router;

describe("marketing.router", () => {
  it("exposes the public Discord stats endpoint", () => {
    const route = (router as any).stack.find(
      (layer: any) =>
        layer.route?.path === "/discord-members" &&
        Boolean(layer.route.methods.get),
    );

    expect(route).toBeDefined();
    expect(route.route.stack[0].handle).toBe(getDiscordMembers);
  });
});
