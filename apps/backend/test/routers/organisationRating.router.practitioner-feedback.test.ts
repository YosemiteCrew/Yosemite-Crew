import type { Router } from "express";

const requireMobileAuth = jest.fn((_req, _res, next) => next());
const PractitionerFeedbackController = {
  getForParent: jest.fn(),
  getForAppointment: jest.fn(),
  rateAppointment: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({ requireMobileAuth }));
jest.mock("../../src/controllers/app/practitioner-feedback.controller", () => ({
  PractitionerFeedbackController,
}));

const router = jest.requireActual("../../src/routers/organisationRating.router")
  .default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const findRoute = (path: string, method: "get" | "post" | "put") =>
  ((router as unknown as { stack: Layer[] }).stack ?? []).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  )?.route;

describe("practitioner feedback routes", () => {
  const batchLookupPath = "/practitioner-feedback/batch";
  const lookupPath = "/practitioner-feedback";
  const savePath = "/appointment/:appointmentId/practitioner-feedback";

  it("requires mobile authentication before reading feedback", () => {
    expect(
      findRoute(lookupPath, "post")?.stack.map((layer) => layer.handle),
    ).toEqual([
      requireMobileAuth,
      PractitionerFeedbackController.getForAppointment,
    ]);
  });

  it("requires mobile authentication before batch loading feedback", () => {
    expect(
      findRoute(batchLookupPath, "post")?.stack.map((layer) => layer.handle),
    ).toEqual([requireMobileAuth, PractitionerFeedbackController.getForParent]);
  });

  it("requires mobile authentication before saving feedback", () => {
    expect(
      findRoute(savePath, "put")?.stack.map((layer) => layer.handle),
    ).toEqual([
      requireMobileAuth,
      PractitionerFeedbackController.rateAppointment,
    ]);
  });
});
