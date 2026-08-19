import { EmergencyTriageService } from "../../src/services/emergency-triage.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    emergencyTriage: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));

import { prisma } from "src/config/prisma";

const mockCreate = prisma.emergencyTriage.create as jest.Mock;
const mockFindFirst = prisma.emergencyTriage.findFirst as jest.Mock;
const mockFindMany = prisma.emergencyTriage.findMany as jest.Mock;
const mockUpdate = prisma.emergencyTriage.update as jest.Mock;

const baseTriage = {
  id: "et-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: null,
  triagePriority: "IMMEDIATE" as const,
  chiefComplaint: "Severe dyspnoea",
  presentationAt: new Date("2026-06-30T08:00:00Z"),
  heartRate: 180,
  respiratoryRate: 60,
  temperature: null,
  bloodPressureSystolic: null,
  bloodPressureDiastolic: null,
  oxygenSaturation: null,
  capillaryRefillTime: null,
  mentalStatus: "Obtunded",
  escalated: false,
  escalatedAt: null,
  escalatedReason: null,
  triageBy: "vet-1",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("EmergencyTriageService.record", () => {
  it("creates a triage record and returns it", async () => {
    mockCreate.mockResolvedValue(baseTriage);
    const result = await EmergencyTriageService.record({
      organisationId: "org-1",
      patientId: "pat-1",
      triagePriority: "IMMEDIATE",
      chiefComplaint: "Severe dyspnoea",
      presentationAt: new Date("2026-06-30T08:00:00Z"),
      triageBy: "vet-1",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ triagePriority: "IMMEDIATE" }),
      }),
    );
    expect(result.chiefComplaint).toBe("Severe dyspnoea");
  });
});

describe("EmergencyTriageService.get", () => {
  it("returns triage when found", async () => {
    mockFindFirst.mockResolvedValue(baseTriage);
    const result = await EmergencyTriageService.get("et-1", "org-1");
    expect(result.id).toBe("et-1");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      EmergencyTriageService.get("et-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("EmergencyTriageService.list", () => {
  it("returns records for an organisation", async () => {
    mockFindMany.mockResolvedValue([baseTriage]);
    const result = await EmergencyTriageService.list({
      organisationId: "org-1",
    });
    expect(result).toHaveLength(1);
  });

  it("applies date range filter when from/to supplied", async () => {
    mockFindMany.mockResolvedValue([]);
    const from = new Date("2026-06-01");
    const to = new Date("2026-06-30");
    await EmergencyTriageService.list({ organisationId: "org-1", from, to });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          presentationAt: { gte: from, lte: to },
        }),
      }),
    );
  });
});

describe("EmergencyTriageService.escalate", () => {
  it("escalates a non-escalated triage record", async () => {
    const escalated = {
      ...baseTriage,
      escalated: true,
      escalatedAt: new Date(),
      escalatedReason: "Deteriorated",
    };
    mockFindFirst.mockResolvedValue(baseTriage);
    mockUpdate.mockResolvedValue(escalated);
    const result = await EmergencyTriageService.escalate(
      "et-1",
      "org-1",
      { escalatedReason: "Deteriorated" },
      "vet-1",
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          escalated: true,
          escalatedReason: "Deteriorated",
        }),
      }),
    );
    expect(result.escalated).toBe(true);
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      EmergencyTriageService.escalate("et-x", "org-1", {
        escalatedReason: "test",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 409 when already escalated", async () => {
    mockFindFirst.mockResolvedValue({ ...baseTriage, escalated: true });
    await expect(
      EmergencyTriageService.escalate("et-1", "org-1", {
        escalatedReason: "again",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
