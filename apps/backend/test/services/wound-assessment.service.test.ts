import { WoundAssessmentService } from "../../src/services/wound-assessment.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    woundAssessment: {
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

const mockCreate = prisma.woundAssessment.create as jest.Mock;
const mockFindFirst = prisma.woundAssessment.findFirst as jest.Mock;
const mockFindMany = prisma.woundAssessment.findMany as jest.Mock;
const mockDelete = prisma.woundAssessment.delete as jest.Mock;

const baseAssessment = {
  id: "wa-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: null,
  surgicalProcedureId: null,
  woundType: "SURGICAL_INCISION" as const,
  location: "Left forelimb",
  lengthCm: null,
  widthCm: null,
  depthCm: null,
  healingStage: null,
  healingStatus: "HEALING" as const,
  exudateType: null,
  exudateAmount: null,
  odour: null,
  woundBed: null,
  woundEdges: null,
  periwoundSkin: null,
  dressing: null,
  dressingChangeFreq: null,
  assessedAt: new Date("2026-06-30T10:00:00Z"),
  assessedBy: "vet-1",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("WoundAssessmentService.record", () => {
  it("creates a wound assessment and returns it", async () => {
    mockCreate.mockResolvedValue(baseAssessment);
    const result = await WoundAssessmentService.record({
      organisationId: "org-1",
      patientId: "pat-1",
      woundType: "SURGICAL_INCISION",
      location: "Left forelimb",
      assessedAt: new Date("2026-06-30T10:00:00Z"),
      assessedBy: "vet-1",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organisationId: "org-1" }),
      }),
    );
    expect(result.woundType).toBe("SURGICAL_INCISION");
  });

  it("defaults healingStatus to HEALING when not provided", async () => {
    mockCreate.mockResolvedValue(baseAssessment);
    await WoundAssessmentService.record({
      organisationId: "org-1",
      patientId: "pat-1",
      woundType: "LACERATION",
      location: "Dorsal",
      assessedAt: new Date(),
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ healingStatus: "HEALING" }),
      }),
    );
  });
});

describe("WoundAssessmentService.get", () => {
  it("returns an assessment when found", async () => {
    mockFindFirst.mockResolvedValue(baseAssessment);
    const result = await WoundAssessmentService.get("wa-1", "org-1");
    expect(result.id).toBe("wa-1");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      WoundAssessmentService.get("wa-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("WoundAssessmentService.list", () => {
  it("returns all assessments for an organisation", async () => {
    mockFindMany.mockResolvedValue([baseAssessment]);
    const result = await WoundAssessmentService.list({
      organisationId: "org-1",
    });
    expect(result).toHaveLength(1);
  });

  it("filters by patientId when provided", async () => {
    mockFindMany.mockResolvedValue([]);
    await WoundAssessmentService.list({
      organisationId: "org-1",
      patientId: "pat-2",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ patientId: "pat-2" }),
      }),
    );
  });

  it("filters by date range when from/to provided", async () => {
    mockFindMany.mockResolvedValue([]);
    const from = new Date("2026-01-01");
    const to = new Date("2026-06-30");
    await WoundAssessmentService.list({ organisationId: "org-1", from, to });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assessedAt: { gte: from, lte: to },
        }),
      }),
    );
  });
});

describe("WoundAssessmentService.delete", () => {
  it("deletes assessment when found", async () => {
    mockFindFirst.mockResolvedValue(baseAssessment);
    await WoundAssessmentService.delete("wa-1", "org-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "wa-1" } });
  });

  it("throws 404 when not found before delete", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      WoundAssessmentService.delete("wa-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
