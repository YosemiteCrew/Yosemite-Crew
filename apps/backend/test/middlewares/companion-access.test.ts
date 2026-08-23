import type { NextFunction, Request, Response } from "express";

jest.mock("src/config/prisma", () => ({
  prisma: { parentPatient: { findFirst: jest.fn() } },
}));
jest.mock("src/services/shared/parent-identity", () => ({
  findParentIdForAuthUser: jest.fn(),
}));

import { prisma } from "src/config/prisma";
import { findParentIdForAuthUser } from "src/services/shared/parent-identity";
import { requireCompanionPermission } from "src/middlewares/companion-access";

const findFirst = (
  prisma as unknown as {
    parentPatient: { findFirst: jest.Mock };
  }
).parentPatient.findFirst;
const findParent = findParentIdForAuthUser as jest.Mock;

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
