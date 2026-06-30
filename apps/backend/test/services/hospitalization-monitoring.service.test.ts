import { HospitalizationMonitoringService } from "src/services/hospitalization-monitoring.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    hospitalizationMonitoring: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock("src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn().mockResolvedValue(undefined) },
}));

const pm = prisma as unknown as {
  hospitalizationMonitoring: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    delete: jest.Mock;
  };
};

const makeObs = (over: Record<string, unknown> = {}) => ({
  id: "obs-1",
  organisationId: "org-1",
  patientId: "pat-1",
  admissionId: "adm-1",
  encounterId: "enc-1",
  observedAt: new Date("2026-06-30T10:00:00Z"),
  observedBy: "nurse-1",
  temperature: 38.2,
  temperatureUnit: "C",
  heartRate: 88,
  respiratoryRate: 18,
  spo2: 99,
  bloodPressureSystolic: 120,
  bloodPressureDiastolic: 80,
  etco2: null,
  painScore: 2,
  crtSecs: 1.5,
  mucousMembranes: "pink, moist",
  inputMl: 250,
  outputMl: 100,
  mentalStatus: "alert",
  appetite: "eating well",
  urination: "adequate",
  defecation: null,
  notes: "Recovering well post-op",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (AuditTrailService.recordSafely as jest.Mock).mockResolvedValue(undefined);
  pm.hospitalizationMonitoring.findFirst.mockResolvedValue(makeObs());
  pm.hospitalizationMonitoring.create.mockResolvedValue(makeObs());
  pm.hospitalizationMonitoring.findMany.mockResolvedValue([makeObs()]);
  pm.hospitalizationMonitoring.delete.mockResolvedValue(undefined);
});

describe("HospitalizationMonitoringService.record", () => {
  it("creates an observation and emits audit", async () => {
    const result = await HospitalizationMonitoringService.record({
      organisationId: "org-1",
      patientId: "pat-1",
      admissionId: "adm-1",
      observedAt: new Date("2026-06-30T10:00:00Z"),
      observedBy: "nurse-1",
      temperature: 38.2,
      heartRate: 88,
      painScore: 2,
    });
    expect(pm.hospitalizationMonitoring.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          temperature: 38.2,
          heartRate: 88,
          painScore: 2,
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "HOSPITALIZATION_OBS_RECORDED",
        actorId: "nurse-1",
      }),
    );
    expect(result.id).toBe("obs-1");
  });
});

describe("HospitalizationMonitoringService.get", () => {
  it("returns an obs by id and org", async () => {
    const result = await HospitalizationMonitoringService.get("obs-1", "org-1");
    expect(result.id).toBe("obs-1");
  });

  it("404s an unknown obs", async () => {
    pm.hospitalizationMonitoring.findFirst.mockResolvedValue(null);
    await expect(
      HospitalizationMonitoringService.get("bad", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("HospitalizationMonitoringService.list", () => {
  it("lists observations for the org", async () => {
    const result = await HospitalizationMonitoringService.list({
      organisationId: "org-1",
    });
    expect(result).toHaveLength(1);
  });

  it("filters by admissionId and date range", async () => {
    const from = new Date("2026-06-30T00:00:00Z");
    const to = new Date("2026-06-30T23:59:59Z");
    await HospitalizationMonitoringService.list({
      organisationId: "org-1",
      admissionId: "adm-1",
      from,
      to,
    });
    expect(pm.hospitalizationMonitoring.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          admissionId: "adm-1",
          observedAt: { gte: from, lte: to },
        }),
      }),
    );
  });
});

describe("HospitalizationMonitoringService.delete", () => {
  it("deletes an obs after verifying it exists", async () => {
    await HospitalizationMonitoringService.delete("obs-1", "org-1");
    expect(pm.hospitalizationMonitoring.findFirst).toHaveBeenCalled();
    expect(pm.hospitalizationMonitoring.delete).toHaveBeenCalledWith({
      where: { id: "obs-1" },
    });
  });

  it("404s deleting unknown obs", async () => {
    pm.hospitalizationMonitoring.findFirst.mockResolvedValue(null);
    await expect(
      HospitalizationMonitoringService.delete("bad", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
