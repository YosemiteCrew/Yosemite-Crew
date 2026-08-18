import {
  PatientProblemService,
  PatientProblemError,
} from "src/services/patient-problem.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    patientOrganisation: { findFirst: jest.fn() },
    patientProblem: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn().mockResolvedValue(undefined) },
}));

const pm = prisma as unknown as {
  patientOrganisation: { findFirst: jest.Mock };
  patientProblem: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
};

const makeProblem = (over: Record<string, unknown> = {}) => ({
  id: "problem-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: null,
  name: "Diabetes mellitus",
  codeSystem: "ICD-10",
  code: "E11.9",
  status: "ACTIVE",
  severity: "MODERATE",
  onsetDate: new Date("2025-01-01"),
  resolvedDate: null,
  notes: null,
  recordedBy: "vet-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (AuditTrailService.recordSafely as jest.Mock).mockResolvedValue(undefined);
  // Creating a clinical row now proves the companion belongs to the caller's org.
  pm.patientOrganisation.findFirst.mockResolvedValue({ id: "link-1" });
  pm.patientProblem.findFirst.mockResolvedValue(makeProblem());
  pm.patientProblem.create.mockResolvedValue(makeProblem());
  pm.patientProblem.update.mockImplementation(
    (args: { data: Record<string, unknown> }) =>
      Promise.resolve(makeProblem({ ...args.data })),
  );
  pm.patientProblem.findMany.mockResolvedValue([makeProblem()]);
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe("PatientProblemService.create", () => {
  it("404s a companion that is not in the caller's organisation", async () => {
    // PatientProblem has no FK to Patient, so nothing downstream would reject a
    // nonexistent or foreign-tenant id.
    pm.patientOrganisation.findFirst.mockResolvedValue(null);
    await expect(
      PatientProblemService.create({
        organisationId: "org-1",
        patientId: "other-tenant-pat",
        name: "Otitis externa",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(pm.patientProblem.create).not.toHaveBeenCalled();
  });

  it("creates an ACTIVE problem and emits audit", async () => {
    const result = await PatientProblemService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      name: "Diabetes mellitus",
      codeSystem: "ICD-10",
      code: "E11.9",
      severity: "MODERATE",
      recordedBy: "vet-1",
    });
    expect(pm.patientProblem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ACTIVE",
          name: "Diabetes mellitus",
          code: "E11.9",
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "PROBLEM_CREATED",
        actorId: "vet-1",
      }),
    );
    expect(result.status).toBe("ACTIVE");
  });

  it("creates a problem without optional fields", async () => {
    await PatientProblemService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      name: "Epilepsy",
    });
    expect(pm.patientProblem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Epilepsy", status: "ACTIVE" }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// get / list
// ---------------------------------------------------------------------------

describe("PatientProblemService.get", () => {
  it("returns problem by id and org", async () => {
    const result = await PatientProblemService.get("problem-1", "org-1");
    expect(result.id).toBe("problem-1");
  });

  it("404s an unknown problem", async () => {
    pm.patientProblem.findFirst.mockResolvedValue(null);
    await expect(
      PatientProblemService.get("bad", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("PatientProblemService.list", () => {
  it("lists all problems for the org", async () => {
    const result = await PatientProblemService.list({
      organisationId: "org-1",
    });
    expect(result).toHaveLength(1);
  });

  it("filters by patientId and status", async () => {
    await PatientProblemService.list({
      organisationId: "org-1",
      patientId: "pat-1",
      status: "ACTIVE",
    });
    expect(pm.patientProblem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: "pat-1",
          status: "ACTIVE",
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe("PatientProblemService.update", () => {
  it("derives resolvedDate and audits PROBLEM_RESOLVED on a status PATCH", async () => {
    // Previously this left resolvedDate null with only a PROBLEM_UPDATED audit,
    // and resolve() then 409'd so the date could never be filled afterwards.
    pm.patientProblem.findFirst.mockResolvedValue(
      makeProblem({ status: "ACTIVE" }),
    );
    await PatientProblemService.update("prob-1", "org-1", {
      status: "RESOLVED",
    });
    expect(
      pm.patientProblem.update.mock.calls[0][0].data.resolvedDate,
    ).toBeInstanceOf(Date);
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "PROBLEM_RESOLVED" }),
    );
  });

  it("honours an explicit resolvedDate", async () => {
    const when = new Date("2026-05-01T00:00:00Z");
    pm.patientProblem.findFirst.mockResolvedValue(
      makeProblem({ status: "ACTIVE" }),
    );
    await PatientProblemService.update("prob-1", "org-1", {
      status: "RESOLVED",
      resolvedDate: when,
    });
    expect(pm.patientProblem.update.mock.calls[0][0].data.resolvedDate).toBe(
      when,
    );
  });

  it("clears resolvedDate when a resolved problem is reactivated", async () => {
    pm.patientProblem.findFirst.mockResolvedValue(
      makeProblem({ status: "RESOLVED", resolvedDate: new Date() }),
    );
    await PatientProblemService.update("prob-1", "org-1", { status: "ACTIVE" });
    expect(
      pm.patientProblem.update.mock.calls[0][0].data.resolvedDate,
    ).toBeNull();
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "PROBLEM_UPDATED" }),
    );
  });

  it("clears resolvedDate when moved to INACTIVE", async () => {
    pm.patientProblem.findFirst.mockResolvedValue(
      makeProblem({ status: "RESOLVED", resolvedDate: new Date() }),
    );
    await PatientProblemService.update("prob-1", "org-1", {
      status: "INACTIVE",
    });
    expect(
      pm.patientProblem.update.mock.calls[0][0].data.resolvedDate,
    ).toBeNull();
  });

  it("keeps PROBLEM_UPDATED when an already-resolved problem is edited", async () => {
    pm.patientProblem.findFirst.mockResolvedValue(
      makeProblem({ status: "RESOLVED", resolvedDate: new Date() }),
    );
    await PatientProblemService.update("prob-1", "org-1", {
      status: "RESOLVED",
      notes: "still resolved",
    });
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "PROBLEM_UPDATED" }),
    );
  });

  it("leaves resolvedDate untouched on a non-status edit", async () => {
    pm.patientProblem.findFirst.mockResolvedValue(
      makeProblem({ status: "ACTIVE" }),
    );
    await PatientProblemService.update("prob-1", "org-1", { notes: "n" });
    expect(pm.patientProblem.update.mock.calls[0][0].data).not.toHaveProperty(
      "resolvedDate",
    );
  });

  it("updates problem fields and emits audit", async () => {
    await PatientProblemService.update(
      "problem-1",
      "org-1",
      { severity: "SEVERE", notes: "Worsening" },
      "vet-1",
    );
    expect(pm.patientProblem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          severity: "SEVERE",
          notes: "Worsening",
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "PROBLEM_UPDATED",
        actorId: "vet-1",
      }),
    );
  });

  it("can change status to INACTIVE", async () => {
    await PatientProblemService.update("problem-1", "org-1", {
      status: "INACTIVE",
    });
    expect(pm.patientProblem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "INACTIVE" }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// resolve
// ---------------------------------------------------------------------------

describe("PatientProblemService.resolve", () => {
  it("marks ACTIVE problem as RESOLVED with resolvedDate", async () => {
    const resolvedDate = new Date("2026-06-30");
    const result = await PatientProblemService.resolve(
      "problem-1",
      "org-1",
      "vet-1",
      resolvedDate,
    );
    expect(pm.patientProblem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "RESOLVED", resolvedDate }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "PROBLEM_RESOLVED",
        actorId: "vet-1",
      }),
    );
    expect(result.status).toBe("RESOLVED");
  });

  it("uses current date when resolvedDate not provided", async () => {
    await PatientProblemService.resolve("problem-1", "org-1");
    expect(pm.patientProblem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "RESOLVED" }),
      }),
    );
  });

  it("rejects resolving an already-resolved problem", async () => {
    pm.patientProblem.findFirst.mockResolvedValue(
      makeProblem({ status: "RESOLVED" }),
    );
    await expect(
      PatientProblemService.resolve("problem-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
