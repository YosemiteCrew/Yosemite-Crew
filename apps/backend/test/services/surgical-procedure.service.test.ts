import {
  SurgicalProcedureService,
  SurgicalProcedureError,
} from "src/services/surgical-procedure.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    surgicalProcedure: {
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
  surgicalProcedure: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
};

const makeSurgery = (over: Record<string, unknown> = {}) => ({
  id: "surg-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: "enc-1",
  procedureName: "Splenectomy",
  surgeon: "Dr. Smith",
  assistants: ["Dr. Jones"],
  anesthesiaType: "GENERAL",
  anesthesiaAgent: "Isoflurane",
  anesthesiaDoseMs: null,
  startedAt: new Date("2026-06-30T09:00:00Z"),
  endedAt: new Date("2026-06-30T10:30:00Z"),
  durationMinutes: 90,
  outcome: "PENDING",
  complications: null,
  instruments: ["scalpel", "retractor"],
  specimensSent: ["spleen tissue"],
  postOpNotes: "Patient stable post-op",
  performedBy: "vet-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (AuditTrailService.recordSafely as jest.Mock).mockResolvedValue(undefined);
  pm.surgicalProcedure.findFirst.mockResolvedValue(makeSurgery());
  pm.surgicalProcedure.create.mockResolvedValue(makeSurgery());
  pm.surgicalProcedure.update.mockImplementation(
    (args: { data: Record<string, unknown> }) =>
      Promise.resolve(makeSurgery({ ...args.data })),
  );
  pm.surgicalProcedure.findMany.mockResolvedValue([makeSurgery()]);
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe("SurgicalProcedureService.create", () => {
  it("creates a PENDING surgical record and emits audit", async () => {
    const result = await SurgicalProcedureService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      encounterId: "enc-1",
      procedureName: "Splenectomy",
      surgeon: "Dr. Smith",
      anesthesiaType: "GENERAL",
      performedBy: "vet-1",
    });
    expect(pm.surgicalProcedure.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          procedureName: "Splenectomy",
          outcome: "PENDING",
          anesthesiaType: "GENERAL",
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "SURGERY_RECORDED",
        actorId: "vet-1",
      }),
    );
    expect(result.outcome).toBe("PENDING");
  });

  it("stores empty arrays for assistants, instruments, specimensSent when omitted", async () => {
    await SurgicalProcedureService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      procedureName: "Dental",
    });
    expect(pm.surgicalProcedure.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assistants: [],
          instruments: [],
          specimensSent: [],
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// get / list
// ---------------------------------------------------------------------------

describe("SurgicalProcedureService.get", () => {
  it("returns a surgical record by id and org", async () => {
    const result = await SurgicalProcedureService.get("surg-1", "org-1");
    expect(result.id).toBe("surg-1");
  });

  it("404s an unknown record", async () => {
    pm.surgicalProcedure.findFirst.mockResolvedValue(null);
    await expect(
      SurgicalProcedureService.get("bad", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("SurgicalProcedureService.list", () => {
  it("lists all procedures for the org", async () => {
    const result = await SurgicalProcedureService.list({
      organisationId: "org-1",
    });
    expect(result).toHaveLength(1);
  });

  it("filters by patientId, encounterId, and outcome", async () => {
    await SurgicalProcedureService.list({
      organisationId: "org-1",
      patientId: "pat-1",
      encounterId: "enc-1",
      outcome: "SUCCESS",
    });
    expect(pm.surgicalProcedure.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: "pat-1",
          encounterId: "enc-1",
          outcome: "SUCCESS",
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe("SurgicalProcedureService.update", () => {
  it("updates fields and emits SURGERY_OUTCOME_UPDATED when outcome changes", async () => {
    pm.surgicalProcedure.update.mockResolvedValue(
      makeSurgery({ outcome: "SUCCESS" }),
    );
    await SurgicalProcedureService.update(
      "surg-1",
      "org-1",
      { outcome: "SUCCESS", postOpNotes: "Recovered well" },
      "vet-1",
    );
    expect(pm.surgicalProcedure.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ outcome: "SUCCESS" }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "SURGERY_OUTCOME_UPDATED" }),
    );
  });

  it("emits SURGERY_RECORDED when outcome not changed", async () => {
    await SurgicalProcedureService.update(
      "surg-1",
      "org-1",
      { postOpNotes: "Updated notes" },
      "vet-1",
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "SURGERY_RECORDED" }),
    );
  });

  it("404s on missing record", async () => {
    pm.surgicalProcedure.findFirst.mockResolvedValue(null);
    await expect(
      SurgicalProcedureService.update("bad", "org-1", { outcome: "SUCCESS" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
