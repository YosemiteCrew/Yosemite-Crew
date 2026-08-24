import type { Router } from "express";

const requireMobileAuth = jest.fn((_req, _res, next) => next());
const companionGuard = jest.fn((_req, _res, next) => next());
const resourceGuard = jest.fn((_req, _res, next) => next());
const requireCompanionPermission = jest.fn(() => companionGuard);
const requireCompanionPermissionForResource = jest.fn(() => resourceGuard);
const resolveExpenseCompanion = jest.fn();

const ExpenseController = {
  createExpense: jest.fn(),
  updateExpense: jest.fn(),
  deleteExpense: jest.fn(),
  getExpenseById: jest.fn(),
  getExpensesByCompanion: jest.fn(),
  getExpenseSummary: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({ requireMobileAuth }));
jest.mock("../../src/middlewares/companion-access", () => ({
  requireCompanionPermission,
  requireCompanionPermissionForResource,
  resolveExpenseCompanion,
}));
jest.mock("../../src/controllers/app/expense.controller", () => ({
  ExpenseController,
}));

const router = jest.requireActual("../../src/routers/expense.router")
  .default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const findRoute = (path: string, method: string) =>
  ((router as unknown as { stack: Layer[] }).stack ?? []).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  )?.route;

describe("expense.router", () => {
  /**
   * These assert the middleware is MOUNTED, which the middleware's own unit
   * tests cannot do. Deleting the guard from a route leaves every test in
   * companion-access.test.ts green while reopening the hole it was written for:
   * `/:expenseId` resolved the row by id alone, so any signed-in parent could
   * read, edit, or delete another parent's expense.
   */
  it.each([
    ["get", "reading"],
    ["patch", "editing"],
    ["delete", "deleting"],
  ])("guards %s /:expenseId (%s another parent's expense)", (method) => {
    const route = findRoute("/:expenseId", method);
    expect(route).toBeDefined();
    expect(route?.stack).toHaveLength(3);
    const handles = route?.stack.map((l) => l.handle);
    expect(handles).toContain(requireMobileAuth);
    expect(handles).toContain(resourceGuard);
  });

  it("resolves the companion off the expense row, for the expenses feature", () => {
    // The id in the path is an expense, not a patient, so the patient-param
    // form of the guard would have nothing to read and must not be used here.
    expect(requireCompanionPermissionForResource).toHaveBeenCalledWith(
      "expenses",
      resolveExpenseCompanion,
    );
  });

  it("keeps the patient-param guard on the companion list and summary", () => {
    for (const path of [
      "/companion/:patientId/list",
      "/companion/:patientId/summary",
    ]) {
      const route = findRoute(path, "get");
      expect(route?.stack).toHaveLength(3);
      expect(route?.stack.map((l) => l.handle)).toContain(companionGuard);
    }
    expect(requireCompanionPermission).toHaveBeenCalledWith(
      "expenses",
      "patientId",
    );
  });

  it("leaves create unguarded by a companion check, since it has no id yet", () => {
    // Ownership on create comes from the authenticated parent in the body path,
    // not from a row that does not exist yet.
    const route = findRoute("/", "post");
    expect(route?.stack).toHaveLength(2);
    expect(route?.stack.map((l) => l.handle)).toContain(requireMobileAuth);
  });
});
