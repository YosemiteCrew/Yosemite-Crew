import type { NextFunction, Request, Response } from "express";

jest.mock("src/config/prisma", () => ({
  prisma: {
    parentPatient: { findFirst: jest.fn() },
    externalExpense: { findUnique: jest.fn() },
    invoice: { findUnique: jest.fn() },
  },
}));
jest.mock("src/services/shared/parent-identity", () => ({
  findParentIdForAuthUser: jest.fn(),
}));

import { prisma } from "src/config/prisma";
import { findParentIdForAuthUser } from "src/services/shared/parent-identity";
import {
  requireCompanionPermission,
  requireCompanionPermissionForResource,
  resolveExpenseCompanion,
} from "src/middlewares/companion-access";

const findFirst = (
  prisma as unknown as {
    parentPatient: { findFirst: jest.Mock };
  }
).parentPatient.findFirst;
const findParent = findParentIdForAuthUser as jest.Mock;
const expenseFindUnique = (
  prisma as unknown as { externalExpense: { findUnique: jest.Mock } }
).externalExpense.findUnique;
const invoiceFindUnique = (
  prisma as unknown as { invoice: { findUnique: jest.Mock } }
).invoice.findUnique;

const runExpenseMiddleware = async ({
  expenseId = "exp-1",
  userId = "provider-user-1",
} = {}) => {
  const req = { params: { expenseId }, userId } as unknown as Request;
  const json = jest.fn();
  const res = { status: jest.fn(() => ({ json })) } as unknown as Response;
  const next = jest.fn() as NextFunction;
  await requireCompanionPermissionForResource(
    "expenses",
    resolveExpenseCompanion,
  )(req, res, next);
  return { res, json, next };
};

const runMiddleware = async (
  feature: Parameters<typeof requireCompanionPermission>[0] = "documents",
  { patientId = "pat-1", userId = "provider-user-1" } = {},
) => {
  const req = { params: { patientId }, userId } as unknown as Request;
  const json = jest.fn();
  const res = { status: jest.fn(() => ({ json })) } as unknown as Response;
  const next = jest.fn() as NextFunction;
  await requireCompanionPermission(feature)(req, res, next);
  return { res, json, next };
};

const ALL_FALSE = {
  appointments: false,
  medicalRecords: false,
  chatWithVet: false,
  companionProfile: false,
  documents: false,
  emergencyBasedPermissions: false,
  expenses: false,
  tasks: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  findParent.mockResolvedValue("par-1");
});

describe("requireCompanionPermission", () => {
  it("lets a PRIMARY parent through whatever the permissions say", async () => {
    // The permission set describes what a primary parent has DELEGATED. It is
    // not a constraint on them, so an all-false blob must not lock them out of
    // their own companion.
    findFirst.mockResolvedValue({ role: "PRIMARY", permissions: ALL_FALSE });

    const { next, res } = await runMiddleware("documents");

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("lets a co-parent through when the flag is granted", async () => {
    findFirst.mockResolvedValue({
      role: "CO_PARENT",
      permissions: { ...ALL_FALSE, documents: true },
    });

    const { next } = await runMiddleware("documents");

    expect(next).toHaveBeenCalled();
  });

  it("403s a co-parent whose flag is off", async () => {
    // This is the hole. Production has a co-parent with expenses:false and
    // appointments:false whose restrictions the API ignored entirely.
    findFirst.mockResolvedValue({ role: "CO_PARENT", permissions: ALL_FALSE });

    const { res, json, next } = await runMiddleware("expenses");

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      message: "Ask the primary parent to enable expenses access for you.",
    });
  });

  it.each([
    ["a missing key", { documents: true }],
    ["a non-boolean truthy value", { expenses: "yes" }],
    ["null", null],
    ["a non-object", "granted"],
  ])("denies a co-parent on %s", async (_label, permissions) => {
    // An authorisation check denies anything it cannot read as an explicit
    // grant. `=== true` and nothing looser.
    findFirst.mockResolvedValue({ role: "CO_PARENT", permissions });

    const { res, next } = await runMiddleware("expenses");

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  // 404 rather than 403 for these: the existing parent-facing convention is a
  // uniform "not found" so the endpoint cannot be used to discover which
  // patient ids exist.
  // Clinical records get their own grant rather than riding on
  // companionProfile. A primary parent who shared profile details has not
  // thereby shared the pet's signed vaccination, titration and clinical-exam
  // history, so the two must be independently revocable.
  it("does not let companionProfile imply access to medical records", async () => {
    findFirst.mockResolvedValue({
      role: "CO_PARENT",
      permissions: { ...ALL_FALSE, companionProfile: true },
    });

    const { res, next } = await runMiddleware("medicalRecords");

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("grants medical records only on its own key", async () => {
    findFirst.mockResolvedValue({
      role: "CO_PARENT",
      permissions: { ...ALL_FALSE, medicalRecords: true },
    });

    const { next } = await runMiddleware("medicalRecords");

    expect(next).toHaveBeenCalled();
  });

  it("404s when there is no link at all", async () => {
    findFirst.mockResolvedValue(null);
    const { res, json } = await runMiddleware();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ message: "Companion not found." });
  });

  it("404s when the caller has no parent record", async () => {
    findParent.mockResolvedValue(null);
    const { res } = await runMiddleware();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("404s an unauthenticated caller without touching the database", async () => {
    // `null`, not `undefined` - a default parameter treats undefined as absent
    // and would quietly hand the middleware a valid user instead.
    const { res } = await runMiddleware("documents", {
      userId: null as unknown as string,
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(findParent).not.toHaveBeenCalled();
  });

  // Prisma omits an undefined `where` field rather than matching nothing, so
  // `{ patientId: undefined, parentId }` would match this parent's link to ANY
  // patient and grant access. The guard must therefore run BEFORE the query,
  // not merely produce a 404 afterwards.
  it("denies a missing patient id without ever reaching the database", async () => {
    const { res, next } = await runMiddleware("documents", {
      patientId: null as unknown as string,
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(findParent).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("only considers ACTIVE links in a parent role", async () => {
    findFirst.mockResolvedValue({ role: "PRIMARY", permissions: ALL_FALSE });
    await runMiddleware("tasks");
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "ACTIVE",
          role: { in: ["PRIMARY", "CO_PARENT"] },
        }),
      }),
    );
  });
});

describe("requireCompanionPermissionForResource (expenses)", () => {
  beforeEach(() => {
    expenseFindUnique.mockResolvedValue(null);
    invoiceFindUnique.mockResolvedValue(null);
  });

  it("closes the cross-parent read: an expense on someone else's companion is a 404", async () => {
    // The regression this guard exists for. Before it, `GET /expense/:id`
    // resolved the row by id alone and handed it back to any signed-in parent.
    // The caller here holds a session but no link to the expense's companion,
    // so the link lookup finds nothing and the answer must be a bare 404 -
    // never a 403, which would confirm the id belongs to someone.
    expenseFindUnique.mockResolvedValue({ patientId: "someone-elses-pet" });
    findFirst.mockResolvedValue(null);

    const { next, res, json } = await runExpenseMiddleware();

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ message: "Companion not found." });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: "someone-elses-pet",
          parentId: "par-1",
        }),
      }),
    );
  });

  it("checks the permission against the companion named on the expense", async () => {
    expenseFindUnique.mockResolvedValue({ patientId: "pat-9" });
    findFirst.mockResolvedValue({
      role: "CO_PARENT",
      permissions: { ...ALL_FALSE, expenses: true },
    });

    const { next, res } = await runExpenseMiddleware();

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("denies a co-parent whose expenses switch is off", async () => {
    expenseFindUnique.mockResolvedValue({ patientId: "pat-9" });
    findFirst.mockResolvedValue({ role: "CO_PARENT", permissions: ALL_FALSE });

    const { next, res } = await runExpenseMiddleware();

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("falls through to the invoice table, since the route serves both", async () => {
    // `getExpenseById` reads ExternalExpense first and Invoice second. If the
    // resolver stopped at the first table the fall-through would be the bypass.
    invoiceFindUnique.mockResolvedValue({
      patientId: "pat-7",
      parentId: "par-1",
    });
    findFirst.mockResolvedValue({ role: "PRIMARY", permissions: ALL_FALSE });

    const { next } = await runExpenseMiddleware();

    expect(invoiceFindUnique).toHaveBeenCalled();
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ patientId: "pat-7" }),
      }),
    );
    expect(next).toHaveBeenCalled();
  });

  it("allows an invoice raised against the parent with no companion on it", async () => {
    // Nothing to check a companion permission against, so ownership is the
    // whole decision and the resolver proves it before saying yes.
    invoiceFindUnique.mockResolvedValue({ patientId: null, parentId: "par-1" });

    const { next, res } = await runExpenseMiddleware();

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("denies a companion-less invoice belonging to another parent", async () => {
    invoiceFindUnique.mockResolvedValue({
      patientId: null,
      parentId: "another-parent",
    });

    const { next, res } = await runExpenseMiddleware();

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("denies an id that matches no row, without querying permissions", async () => {
    const { next, res } = await runExpenseMiddleware({ expenseId: "nope" });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("denies a blank expense id", async () => {
    const { next, res } = await runExpenseMiddleware({ expenseId: "   " });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(expenseFindUnique).not.toHaveBeenCalled();
  });
});
