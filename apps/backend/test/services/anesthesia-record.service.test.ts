import { AnesthesiaRecordService } from "src/services/anesthesia-record.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    anesthesiaRecord: {
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
  anesthesiaRecord: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
};

const makeRecord = (over: Record<string, unknown> = {}) => ({
  id: "ar-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: "enc-1",
  surgicalProcedureId: "surg-1",
  anesthesiaType: "GENERAL",
  anesthesiologist: "vet-1",
  assistantName: "nurse-1",
  preMedication: "Acepromazine 0.05mg/kg IM",
  inductionAgent: "Propofol 4mg/kg IV",
  maintenanceAgent: "Isoflurane 1.5% in O2",
  oxygenFlowLpm: 2,
  inductionTime: new Date("2026-06-30T09:00:00Z"),
  intubationTime: new Date("2026-06-30T09:02:00Z"),
  recoveryStartTime: null,
  recoveryEndTime: null,
  complications: null,
  recoveryNotes: null,
  status: "IN_PROGRESS",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (AuditTrailService.recordSafely as jest.Mock).mockResolvedValue(undefined);
  pm.anesthesiaRecord.findFirst.mockResolvedValue(makeRecord());
  pm.anesthesiaRecord.create.mockResolvedValue(makeRecord());
  pm.anesthesiaRecord.update.mockImplementation(
    (args: { data: Record<string, unknown> }) =>
      Promise.resolve(makeRecord({ ...args.data })),
  );
  pm.anesthesiaRecord.findMany.mockResolvedValue([makeRecord()]);
});

describe("AnesthesiaRecordService.create", () => {
  it("creates an IN_PROGRESS record and emits audit", async () => {
    const result = await AnesthesiaRecordService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      encounterId: "enc-1",
      surgicalProcedureId: "surg-1",
      anesthesiaType: "GENERAL",
      anesthesiologist: "vet-1",
      preMedication: "Acepromazine 0.05mg/kg IM",
      inductionAgent: "Propofol 4mg/kg IV",
      maintenanceAgent: "Isoflurane 1.5% in O2",
    });
    expect(pm.anesthesiaRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "IN_PROGRESS",
          anesthesiaType: "GENERAL",
          surgicalProcedureId: "surg-1",
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "ANESTHESIA_RECORD_CREATED",
        actorId: "vet-1",
      }),
    );
    expect(result.status).toBe("IN_PROGRESS");
  });
});

describe("AnesthesiaRecordService.get", () => {
  it("returns a record by id and org", async () => {
    const result = await AnesthesiaRecordService.get("ar-1", "org-1");
    expect(result.id).toBe("ar-1");
  });

  it("404s an unknown record", async () => {
    pm.anesthesiaRecord.findFirst.mockResolvedValue(null);
    await expect(
      AnesthesiaRecordService.get("bad", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("AnesthesiaRecordService.list", () => {
  it("lists records for the org", async () => {
    const result = await AnesthesiaRecordService.list({
      organisationId: "org-1",
    });
    expect(result).toHaveLength(1);
  });

  it("filters by surgicalProcedureId", async () => {
    await AnesthesiaRecordService.list({
      organisationId: "org-1",
      surgicalProcedureId: "surg-1",
    });
    expect(pm.anesthesiaRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ surgicalProcedureId: "surg-1" }),
      }),
    );
  });
});

describe("AnesthesiaRecordService.update", () => {
  it("adds recovery times and emits ANESTHESIA_RECORD_UPDATED", async () => {
    await AnesthesiaRecordService.update(
      "ar-1",
      "org-1",
      {
        recoveryStartTime: new Date("2026-06-30T11:00:00Z"),
        recoveryEndTime: new Date("2026-06-30T11:30:00Z"),
      },
      "vet-1",
    );
    expect(pm.anesthesiaRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recoveryStartTime: new Date("2026-06-30T11:00:00Z"),
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "ANESTHESIA_RECORD_UPDATED" }),
    );
  });

  it("emits ANESTHESIA_RECORD_COMPLETED when status is COMPLETED", async () => {
    pm.anesthesiaRecord.update.mockResolvedValue(
      makeRecord({ status: "COMPLETED" }),
    );
    await AnesthesiaRecordService.update("ar-1", "org-1", {
      status: "COMPLETED",
    });
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "ANESTHESIA_RECORD_COMPLETED" }),
    );
  });

  it("rejects updates on a completed record", async () => {
    pm.anesthesiaRecord.findFirst.mockResolvedValue(
      makeRecord({ status: "COMPLETED" }),
    );
    await expect(
      AnesthesiaRecordService.update("ar-1", "org-1", {
        complications: "Bradycardia",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
