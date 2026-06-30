import {
  PatientProblemService,
  PatientProblemError,
} from "src/services/patient-problem.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
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
