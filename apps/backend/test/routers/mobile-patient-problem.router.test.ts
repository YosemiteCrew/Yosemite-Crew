import type { Router } from "express";

const requireMobileAuth = jest.fn((_req, _res, next) => next());
const companionGuard = jest.fn((_req, _res, next) => next());
const requireCompanionPermission = jest.fn();

const MobilePatientProblemController = { listForCompanion: jest.fn() };

jest.mock("../../src/middlewares/auth", () => ({ requireMobileAuth }));

jest.mock("../../src/middlewares/companion-access", () => ({
  requireCompanionPermission: (...args: unknown[]) => {
    requireCompanionPermission(...args);
    return companionGuard;
  },
}));

jest.mock("../../src/controllers/app/patient-problem.controller", () => ({
  MobilePatientProblemController,
}));

const router = jest.requireActual(
  "../../src/routers/mobile-patient-problem.router",
).default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const findRoute = (path: string, method: "get") =>
  ((router as unknown as { stack: Layer[] }).stack ?? []).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  )?.route;

/*
 * The whole access decision for this endpoint lives in the middleware chain -
 * the handler deliberately repeats none of it. So the chain is the control,
 * and these assertions are what stop a later edit from removing it and leaving
 * a route that hands any signed-in parent any animal's problem list.
 */
describe("mobile-patient-problem.router", () => {
  it("guards the companion problem list with mobile auth then the companion gate", () => {
    const route = findRoute("/mobile/companion/:patientId", "get");

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      requireMobileAuth,
      companionGuard,
      MobilePatientProblemController.listForCompanion,
    ]);
  });

  it("gates on medicalRecords for the patient id in the path", () => {
    expect(requireCompanionPermission).toHaveBeenCalledWith(
      "medicalRecords",
      "patientId",
    );
  });
});
