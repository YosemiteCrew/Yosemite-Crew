import { PocLabService } from "../../src/services/poc-lab.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    patientOrganisation: { findFirst: jest.fn() },
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
import { AuditTrailService } from "../../src/services/audit-trail.service";

const mockMembership = prisma.patientOrganisation.findFirst as jest.Mock;
const mockAudit = AuditTrailService.recordSafely as jest.Mock;
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

beforeEach(() => {
  jest.clearAllMocks();
  mockMembership.mockResolvedValue({ id: "membership-1" });
});

describe("PocLabService.create", () => {
  const input = {
    organisationId: "org-1",
    patientId: "pat-1",
    conductedAt: new Date("2026-06-30T10:00:00Z"),
    conductedBy: "vet-1",
    testType: "CBC" as const,
    results: [{ name: "WBC", value: 8.5, unit: "x10^3/uL" }],
    criticalFlags: ["PLT"],
  };

  it("creates a CBC result with structured parameters", async () => {
    mockCreate.mockResolvedValue(baseResult);
    const result = await PocLabService.create(input);
    expect(mockMembership).toHaveBeenCalledWith({
      where: { patientId: "pat-1", organisationId: "org-1", status: "ACTIVE" },
      select: { id: true },
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organisationId: "org-1",
          patientId: "pat-1",
          conductedBy: "vet-1",
          testType: "CBC",
          criticalFlags: ["PLT"],
          abnormalFlags: [],
          encounterId: null,
        }),
      }),
    );
    expect(result.testType).toBe("CBC");
  });

  it("records the creation in the audit trail against the companion", async () => {
    mockCreate.mockResolvedValue(baseResult);
    await PocLabService.create(input);
    expect(mockAudit).toHaveBeenCalledWith({
      organisationId: "org-1",
      patientId: "pat-1",
      eventType: "POC_LAB_RECORDED",
      actorType: "PMS_USER",
      actorId: "vet-1",
      entityType: "COMPANION",
      entityId: "poc-1",
      metadata: { testType: "CBC", criticalCount: 1 },
    });
  });

  it("stores every optional field the form can send, and nulls for the rest", async () => {
    mockCreate.mockResolvedValue(baseResult);
    await PocLabService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      encounterId: "enc-1",
      conductedAt: new Date("2026-06-30T10:00:00Z"),
      testType: "CBC",
      analyzerName: "ProCyte One",
      sampleType: "Whole blood (EDTA)",
      results: [{ name: "PLT", value: 38, flag: "LL" }],
      overallInterpretation: "Thrombocytopenia",
      abnormalFlags: ["WBC"],
      followUpRecommended: true,
      notes: "Recheck",
    });
    expect(mockCreate.mock.calls[0][0].data).toEqual({
      organisationId: "org-1",
      patientId: "pat-1",
      encounterId: "enc-1",
      conductedAt: new Date("2026-06-30T10:00:00Z"),
      conductedBy: null,
      testType: "CBC",
      analyzerName: "ProCyte One",
      sampleType: "Whole blood (EDTA)",
      results: [{ name: "PLT", value: 38, flag: "LL" }],
      overallInterpretation: "Thrombocytopenia",
      abnormalFlags: ["WBC"],
      criticalFlags: [],
      followUpRecommended: true,
      notes: "Recheck",
    });
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: null,
        metadata: { testType: "CBC", criticalCount: 0 },
      }),
    );
  });

  it("refuses a companion that is not actively linked to the organisation", async () => {
    mockMembership.mockResolvedValue(null);
    await expect(PocLabService.create(input)).rejects.toMatchObject({
      name: "PocLabError",
      statusCode: 404,
      message: "Companion not found.",
    });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
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
