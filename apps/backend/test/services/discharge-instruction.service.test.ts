import {
  DischargeInstructionService,
  DischargeInstructionError,
} from "src/services/discharge-instruction.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    dischargeInstruction: {
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
  dischargeInstruction: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
};

const makeDischarge = (over: Record<string, unknown> = {}) => ({
  id: "dis-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: "enc-1",
  status: "DRAFT",
  medicationSchedule: "Amoxicillin 250mg twice daily for 7 days",
  dietaryNotes: "Soft food only for 3 days",
  activityNotes: "Restrict exercise for 2 weeks",
  woundCareNotes: "Keep wound dry. Change dressing every 2 days.",
  warningSigns: "Fever, lethargy, discharge from wound",
  followUpDate: new Date("2026-07-07"),
  followUpNotes: "Suture removal at 7-10 days",
  emergencyContact: "+1-555-VET-CARE",
  additionalNotes: null,
  preparedBy: "vet-1",
  sentAt: null,
  acknowledgedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (AuditTrailService.recordSafely as jest.Mock).mockResolvedValue(undefined);
  pm.dischargeInstruction.findFirst.mockResolvedValue(makeDischarge());
  pm.dischargeInstruction.create.mockResolvedValue(makeDischarge());
  pm.dischargeInstruction.update.mockImplementation(
    (args: { data: Record<string, unknown> }) =>
      Promise.resolve(makeDischarge({ ...args.data })),
  );
  pm.dischargeInstruction.findMany.mockResolvedValue([makeDischarge()]);
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe("DischargeInstructionService.create", () => {
  it("creates a DRAFT discharge instruction and emits audit", async () => {
    const result = await DischargeInstructionService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      encounterId: "enc-1",
      medicationSchedule: "Amoxicillin 250mg twice daily for 7 days",
      warningSigns: "Fever, lethargy",
      preparedBy: "vet-1",
    });
    expect(pm.dischargeInstruction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "DRAFT",
          medicationSchedule: "Amoxicillin 250mg twice daily for 7 days",
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "DISCHARGE_INSTRUCTIONS_CREATED",
        actorId: "vet-1",
      }),
    );
    expect(result.status).toBe("DRAFT");
  });
});

// ---------------------------------------------------------------------------
// get / list
// ---------------------------------------------------------------------------

describe("DischargeInstructionService.get", () => {
  it("returns discharge instructions by id and org", async () => {
    const result = await DischargeInstructionService.get("dis-1", "org-1");
    expect(result.id).toBe("dis-1");
  });

  it("404s an unknown record", async () => {
    pm.dischargeInstruction.findFirst.mockResolvedValue(null);
    await expect(
      DischargeInstructionService.get("bad", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("DischargeInstructionService.list", () => {
  it("lists all records for the org", async () => {
    const result = await DischargeInstructionService.list({
      organisationId: "org-1",
    });
    expect(result).toHaveLength(1);
  });

  it("filters by patientId, encounterId, and status", async () => {
    await DischargeInstructionService.list({
      organisationId: "org-1",
      patientId: "pat-1",
      encounterId: "enc-1",
      status: "DRAFT",
    });
    expect(pm.dischargeInstruction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: "pat-1",
          encounterId: "enc-1",
          status: "DRAFT",
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe("DischargeInstructionService.update", () => {
  it("updates fields on a DRAFT instruction", async () => {
    await DischargeInstructionService.update(
      "dis-1",
      "org-1",
      { dietaryNotes: "Normal food from day 5" },
      "vet-1",
    );
    expect(pm.dischargeInstruction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dietaryNotes: "Normal food from day 5",
        }),
      }),
    );
  });

  it("rejects updates on a non-DRAFT instruction", async () => {
    pm.dischargeInstruction.findFirst.mockResolvedValue(
      makeDischarge({ status: "SENT" }),
    );
    await expect(
      DischargeInstructionService.update("dis-1", "org-1", {
        dietaryNotes: "...",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ---------------------------------------------------------------------------
// send / acknowledge
// ---------------------------------------------------------------------------

describe("DischargeInstructionService.send", () => {
  it("transitions DRAFT to SENT and emits audit", async () => {
    await DischargeInstructionService.send("dis-1", "org-1", "vet-1");
    expect(pm.dischargeInstruction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SENT",
          sentAt: expect.any(Date),
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "DISCHARGE_INSTRUCTIONS_SENT",
        actorId: "vet-1",
      }),
    );
  });

  it("rejects sending a non-DRAFT instruction", async () => {
    pm.dischargeInstruction.findFirst.mockResolvedValue(
      makeDischarge({ status: "SENT" }),
    );
    await expect(
      DischargeInstructionService.send("dis-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("DischargeInstructionService.acknowledge", () => {
  it("transitions SENT to ACKNOWLEDGED and emits audit", async () => {
    pm.dischargeInstruction.findFirst.mockResolvedValue(
      makeDischarge({ status: "SENT" }),
    );
    await DischargeInstructionService.acknowledge("dis-1", "org-1");
    expect(pm.dischargeInstruction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ACKNOWLEDGED",
          acknowledgedAt: expect.any(Date),
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "DISCHARGE_INSTRUCTIONS_ACKNOWLEDGED",
      }),
    );
  });

  it("rejects double-acknowledging", async () => {
    pm.dischargeInstruction.findFirst.mockResolvedValue(
      makeDischarge({ status: "ACKNOWLEDGED" }),
    );
    await expect(
      DischargeInstructionService.acknowledge("dis-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
