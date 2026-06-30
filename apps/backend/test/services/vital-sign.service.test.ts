import {
  VitalSignService,
  VitalSignError,
} from "src/services/vital-sign.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    patientVitalSign: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock("src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn().mockResolvedValue(undefined) },
}));

const pm = prisma as unknown as {
  patientVitalSign: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

const makeVital = (over: Record<string, unknown> = {}) => ({
  id: "vs-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: null,
  recordedAt: new Date("2026-06-30T10:00:00Z"),
  recordedBy: "vet-1",
  weightKg: 4.5,
  temperatureCelsius: 38.5,
  pulseRateBpm: 120,
  respiratoryRateBpm: 25,
  systolicBp: null,
  diastolicBp: null,
  bodyConditionScore: 5,
  mucosal: "Pink",
  capRefillTimeSec: 1.5,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (AuditTrailService.recordSafely as jest.Mock).mockResolvedValue(undefined);
  pm.patientVitalSign.findFirst.mockResolvedValue(makeVital());
  pm.patientVitalSign.create.mockResolvedValue(makeVital());
  pm.patientVitalSign.update.mockImplementation(
    (args: { data: Record<string, unknown> }) =>
      Promise.resolve(makeVital({ ...args.data })),
  );
  pm.patientVitalSign.findMany.mockResolvedValue([makeVital()]);
  pm.patientVitalSign.delete.mockResolvedValue(makeVital());
});

// ---------------------------------------------------------------------------
// record
// ---------------------------------------------------------------------------

describe("VitalSignService.record", () => {
  it("creates a vital sign entry and emits audit", async () => {
    const result = await VitalSignService.record({
      organisationId: "org-1",
      patientId: "pat-1",
      weightKg: 4.5,
      temperatureCelsius: 38.5,
      pulseRateBpm: 120,
      recordedBy: "vet-1",
    });
    expect(pm.patientVitalSign.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organisationId: "org-1",
          patientId: "pat-1",
          weightKg: 4.5,
          temperatureCelsius: 38.5,
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "VITAL_SIGNS_RECORDED",
        actorId: "vet-1",
      }),
    );
    expect(result.weightKg).toBe(4.5);
  });

  it("uses now as recordedAt when not provided", async () => {
    await VitalSignService.record({
      organisationId: "org-1",
      patientId: "pat-1",
      pulseRateBpm: 110,
    });
    expect(pm.patientVitalSign.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ patientId: "pat-1" }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// get / list
// ---------------------------------------------------------------------------

describe("VitalSignService.get", () => {
  it("returns a vital sign by id and org", async () => {
    const result = await VitalSignService.get("vs-1", "org-1");
    expect(result.id).toBe("vs-1");
  });

  it("404s an unknown entry", async () => {
    pm.patientVitalSign.findFirst.mockResolvedValue(null);
    await expect(VitalSignService.get("bad", "org-1")).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("VitalSignService.list", () => {
  it("lists vital signs for the org", async () => {
    const result = await VitalSignService.list({ organisationId: "org-1" });
    expect(result).toHaveLength(1);
  });

  it("filters by patientId, encounterId, and date range", async () => {
    const from = new Date("2026-01-01");
    const to = new Date("2026-06-30");
    await VitalSignService.list({
      organisationId: "org-1",
      patientId: "pat-1",
      encounterId: "enc-1",
      from,
      to,
    });
    expect(pm.patientVitalSign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: "pat-1",
          encounterId: "enc-1",
          recordedAt: { gte: from, lte: to },
        }),
      }),
    );
  });

  it("applies a take limit", async () => {
    await VitalSignService.list({ organisationId: "org-1", limit: 10 });
    expect(pm.patientVitalSign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe("VitalSignService.update", () => {
  it("updates fields and emits audit", async () => {
    await VitalSignService.update(
      "vs-1",
      "org-1",
      { weightKg: 5.0, notes: "Weight up" },
      "vet-1",
    );
    expect(pm.patientVitalSign.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ weightKg: 5.0, notes: "Weight up" }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "VITAL_SIGNS_UPDATED" }),
    );
  });

  it("404s on missing entry", async () => {
    pm.patientVitalSign.findFirst.mockResolvedValue(null);
    await expect(
      VitalSignService.update("bad", "org-1", { weightKg: 5.0 }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ---------------------------------------------------------------------------
// delete
// ---------------------------------------------------------------------------

describe("VitalSignService.delete", () => {
  it("deletes the entry", async () => {
    await VitalSignService.delete("vs-1", "org-1");
    expect(pm.patientVitalSign.delete).toHaveBeenCalledWith({
      where: { id: "vs-1" },
    });
  });

  it("404s on missing entry", async () => {
    pm.patientVitalSign.findFirst.mockResolvedValue(null);
    await expect(VitalSignService.delete("bad", "org-1")).rejects.toMatchObject(
      {
        statusCode: 404,
      },
    );
  });
});
