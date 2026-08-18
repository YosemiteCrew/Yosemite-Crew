import { BodyConditionService } from "../../src/services/body-condition.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    bodyConditionRecord: {
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

const mockCreate = prisma.bodyConditionRecord.create as jest.Mock;
const mockFindFirst = prisma.bodyConditionRecord.findFirst as jest.Mock;
const mockFindMany = prisma.bodyConditionRecord.findMany as jest.Mock;
const mockDelete = prisma.bodyConditionRecord.delete as jest.Mock;

const baseRecord = {
  id: "bcr-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: null,
  bcsScale: "BCS_9" as const,
  bcsScore: 6.5,
  muscleConditionScore: "Mild atrophy",
  weightKg: 28.4,
  bodyFatPercentage: null,
  recordedAt: new Date("2026-06-30T08:00:00Z"),
  recordedBy: "vet-1",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("BodyConditionService.record", () => {
  it("creates a body condition record", async () => {
    mockCreate.mockResolvedValue(baseRecord);
    const result = await BodyConditionService.record({
      organisationId: "org-1",
      patientId: "pat-1",
      bcsScale: "BCS_9",
      bcsScore: 6.5,
      weightKg: 28.4,
      muscleConditionScore: "Mild atrophy",
      recordedAt: new Date("2026-06-30T08:00:00Z"),
      recordedBy: "vet-1",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bcsScale: "BCS_9", bcsScore: 6.5 }),
      }),
    );
    expect(result.bcsScore).toBe(6.5);
  });
});

describe("BodyConditionService.get", () => {
  it("returns record when found", async () => {
    mockFindFirst.mockResolvedValue(baseRecord);
    const result = await BodyConditionService.get("bcr-1", "org-1");
    expect(result.id).toBe("bcr-1");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      BodyConditionService.get("bcr-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("BodyConditionService.list", () => {
  it("returns records for an organisation", async () => {
    mockFindMany.mockResolvedValue([baseRecord]);
    const result = await BodyConditionService.list({ organisationId: "org-1" });
    expect(result).toHaveLength(1);
  });

  it("filters by patient when provided", async () => {
    mockFindMany.mockResolvedValue([]);
    await BodyConditionService.list({
      organisationId: "org-1",
      patientId: "pat-2",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ patientId: "pat-2" }),
      }),
    );
  });

  it("applies date range filter", async () => {
    mockFindMany.mockResolvedValue([]);
    const from = new Date("2026-01-01");
    const to = new Date("2026-06-30");
    await BodyConditionService.list({ organisationId: "org-1", from, to });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          recordedAt: { gte: from, lte: to },
        }),
      }),
    );
  });
});

describe("BodyConditionService.delete", () => {
  it("deletes record when found", async () => {
    mockFindFirst.mockResolvedValue(baseRecord);
    await BodyConditionService.delete("bcr-1", "org-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "bcr-1" } });
  });

  it("throws 404 when not found before delete", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      BodyConditionService.delete("bcr-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
