import { PocLabService } from "../../src/services/poc-lab.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    pointOfCareLab: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));

import { prisma } from "src/config/prisma";

const mockCreate = prisma.pointOfCareLab.create as jest.Mock;
const mockFindFirst = prisma.pointOfCareLab.findFirst as jest.Mock;
const mockFindMany = prisma.pointOfCareLab.findMany as jest.Mock;
const mockUpdate = prisma.pointOfCareLab.update as jest.Mock;
const mockDelete = prisma.pointOfCareLab.delete as jest.Mock;

const baseResult = {
  id: "poc-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: null,
  conductedAt: new Date("2026-06-30T10:00:00Z"),
  conductedBy: "vet-1",
  testType: "CBC" as const,
  analyzerName: "IDEXX ProCyte One",
  sampleType: "EDTA whole blood",
  results: [
    {
      name: "WBC",
      value: 8.5,
      unit: "x10^3/uL",
      referenceRangeLow: 6,
      referenceRangeHigh: 17,
      flag: "N",
    },
    { name: "RBC", value: 6.2, unit: "x10^6/uL", flag: "N" },
    { name: "HCT", value: 28, unit: "%", referenceRangeLow: 37, flag: "L" },
  ],
  overallInterpretation: "Mild non-regenerative anaemia",
  abnormalFlags: ["HCT"],
  criticalFlags: [],
  followUpRecommended: true,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("PocLabService.create", () => {
  it("creates a CBC result with structured parameters", async () => {
    mockCreate.mockResolvedValue(baseResult);
    const result = await PocLabService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      conductedAt: new Date("2026-06-30T10:00:00Z"),
      testType: "CBC",
      results: [{ name: "WBC", value: 8.5, unit: "x10^3/uL" }],
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ testType: "CBC" }),
      }),
    );
    expect(result.testType).toBe("CBC");
  });
});

describe("PocLabService.get", () => {
  it("returns result when found", async () => {
    mockFindFirst.mockResolvedValue(baseResult);
    const result = await PocLabService.get("poc-1", "org-1");
    expect(result.id).toBe("poc-1");
    expect(result.abnormalFlags).toEqual(["HCT"]);
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(PocLabService.get("poc-x", "org-1")).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("PocLabService.list", () => {
  it("filters by test type", async () => {
    mockFindMany.mockResolvedValue([baseResult]);
    await PocLabService.list({ organisationId: "org-1", testType: "CBC" });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ testType: "CBC" }),
      }),
    );
  });
});

describe("PocLabService.update", () => {
  it("updates interpretation and flags", async () => {
    const updated = {
      ...baseResult,
      overallInterpretation: "Normal",
      abnormalFlags: [],
    };
    mockFindFirst.mockResolvedValue(baseResult);
    mockUpdate.mockResolvedValue(updated);
    const result = await PocLabService.update("poc-1", "org-1", {
      overallInterpretation: "Normal",
      abnormalFlags: [],
    });
    expect(result.overallInterpretation).toBe("Normal");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      PocLabService.update("poc-x", "org-1", { notes: "x" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("PocLabService.delete", () => {
  it("deletes a result", async () => {
    mockFindFirst.mockResolvedValue(baseResult);
    mockDelete.mockResolvedValue(undefined);
    await PocLabService.delete("poc-1", "org-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "poc-1" } });
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(PocLabService.delete("poc-x", "org-1")).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
