import { PainAssessmentService } from "../../src/services/pain-assessment.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    painAssessment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));

import { prisma } from "src/config/prisma";

const mockCreate = prisma.painAssessment.create as jest.Mock;
const mockFindFirst = prisma.painAssessment.findFirst as jest.Mock;
const mockFindMany = prisma.painAssessment.findMany as jest.Mock;
const mockDelete = prisma.painAssessment.delete as jest.Mock;

const baseAssessment = {
  id: "pa-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: null,
  painScale: "NUMERIC_0_10" as const,
  painScore: 6,
  rawScore: null,
  behaviouralSigns: "Guarding left forelimb",
  vocalisation: false,
  posture: "Hunched",
  assessedAt: new Date("2026-06-30T09:00:00Z"),
  assessedBy: "vet-1",
  interventionType: null,
  interventionDetail: null,
  reassessAt: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("PainAssessmentService.record", () => {
  it("creates a pain assessment and returns it", async () => {
    mockCreate.mockResolvedValue(baseAssessment);
    const result = await PainAssessmentService.record({
      organisationId: "org-1",
      patientId: "pat-1",
      painScale: "NUMERIC_0_10",
      painScore: 6,
      behaviouralSigns: "Guarding left forelimb",
      assessedAt: new Date("2026-06-30T09:00:00Z"),
      assessedBy: "vet-1",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          painScore: 6,
          painScale: "NUMERIC_0_10",
        }),
      }),
    );
    expect(result.painScore).toBe(6);
  });

  it("records intervention type when provided", async () => {
    const withIntervention = {
      ...baseAssessment,
      interventionType: "ANALGESIC_GIVEN" as const,
    };
    mockCreate.mockResolvedValue(withIntervention);
    const result = await PainAssessmentService.record({
      organisationId: "org-1",
      patientId: "pat-1",
      painScale: "NUMERIC_0_10",
      painScore: 7,
      assessedAt: new Date(),
      interventionType: "ANALGESIC_GIVEN",
    });
    expect(result.interventionType).toBe("ANALGESIC_GIVEN");
  });
});

describe("PainAssessmentService.get", () => {
  it("returns an assessment when found", async () => {
    mockFindFirst.mockResolvedValue(baseAssessment);
    const result = await PainAssessmentService.get("pa-1", "org-1");
    expect(result.id).toBe("pa-1");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      PainAssessmentService.get("pa-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("PainAssessmentService.list", () => {
  it("returns all assessments for an organisation", async () => {
    mockFindMany.mockResolvedValue([baseAssessment]);
    const result = await PainAssessmentService.list({
      organisationId: "org-1",
    });
    expect(result).toHaveLength(1);
  });

  it("applies date range filter", async () => {
    mockFindMany.mockResolvedValue([]);
    const from = new Date("2026-06-01");
    const to = new Date("2026-06-30");
    await PainAssessmentService.list({ organisationId: "org-1", from, to });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assessedAt: { gte: from, lte: to },
        }),
      }),
    );
  });
});

describe("PainAssessmentService.delete", () => {
  it("deletes when found", async () => {
    mockFindFirst.mockResolvedValue(baseAssessment);
    await PainAssessmentService.delete("pa-1", "org-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "pa-1" } });
  });

  it("throws 404 when not found before delete", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      PainAssessmentService.delete("pa-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
