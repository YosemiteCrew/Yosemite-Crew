import { BodyConditionRecordService } from "../../src/services/body-condition-record.service";

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
  id: "bcs-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: "enc-1",
  bcsScale: "BCS_9" as const,
  bcsScore: 6,
  muscleConditionScore: "MCS-3",
  weightKg: 28.5,
  bodyFatPercentage: 22,
  recordedAt: new Date("2026-06-30"),
  recordedBy: "Dr Patel",
  notes: "Mildly overweight. Reduce caloric intake by 15%.",
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("BodyConditionRecordService.create", () => {
  it("creates a BCS-9 record with score 6", async () => {
    mockCreate.mockResolvedValue(baseRecord);
    const result = await BodyConditionRecordService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      bcsScale: "BCS_9",
      bcsScore: 6,
      recordedAt: new Date("2026-06-30"),
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bcsScale: "BCS_9",
          bcsScore: 6,
        }),
      }),
    );
    expect(result.bcsScore).toBe(6);
  });
});

describe("BodyConditionRecordService.get", () => {
  it("returns record when found", async () => {
    mockFindFirst.mockResolvedValue(baseRecord);
    const result = await BodyConditionRecordService.get("bcs-1", "org-1");
    expect(result.id).toBe("bcs-1");
    expect(result.bcsScale).toBe("BCS_9");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      BodyConditionRecordService.get("bcs-x", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("BodyConditionRecordService.list", () => {
  it("filters by patientId", async () => {
    mockFindMany.mockResolvedValue([baseRecord]);
    await BodyConditionRecordService.list({
      organisationId: "org-1",
      patientId: "pat-1",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ patientId: "pat-1" }),
      }),
    );
  });

  it("filters by bcsScale", async () => {
    mockFindMany.mockResolvedValue([baseRecord]);
    await BodyConditionRecordService.list({
      organisationId: "org-1",
      bcsScale: "BCS_9",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ bcsScale: "BCS_9" }),
      }),
    );
  });
});

describe("BodyConditionRecordService.trend", () => {
  it("returns records ordered by recordedAt asc with default limit 20", async () => {
    mockFindMany.mockResolvedValue([baseRecord]);
    await BodyConditionRecordService.trend("pat-1", "org-1");
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ patientId: "pat-1" }),
        orderBy: { recordedAt: "asc" },
        take: 20,
      }),
    );
  });

  it("respects a custom limit", async () => {
    mockFindMany.mockResolvedValue([baseRecord]);
    await BodyConditionRecordService.trend("pat-1", "org-1", 5);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }),
    );
  });
});

describe("BodyConditionRecordService.delete", () => {
  it("deletes a record", async () => {
    mockFindFirst.mockResolvedValue(baseRecord);
    mockDelete.mockResolvedValue(undefined);
    await BodyConditionRecordService.delete("bcs-1", "org-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "bcs-1" } });
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      BodyConditionRecordService.delete("bcs-x", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
