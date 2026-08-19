import { OphthalmologyExaminationService } from "../../src/services/ophthalmology-examination.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    ophthalmologyExamination: {
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

const mockCreate = prisma.ophthalmologyExamination.create as jest.Mock;
const mockFindFirst = prisma.ophthalmologyExamination.findFirst as jest.Mock;
const mockFindMany = prisma.ophthalmologyExamination.findMany as jest.Mock;
const mockUpdate = prisma.ophthalmologyExamination.update as jest.Mock;
const mockDelete = prisma.ophthalmologyExamination.delete as jest.Mock;

const baseExam = {
  id: "oe-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: null,
  examinedAt: new Date("2026-06-30T10:00:00Z"),
  examinedBy: "vet-1",
  visionLeft: "NORMAL" as const,
  visionRight: "REDUCED" as const,
  menaceLeft: true,
  menaceRight: false,
  plrDirectLeft: "NORMAL" as const,
  plrDirectRight: "SLUGGISH" as const,
  plrConsensualLeft: "NORMAL" as const,
  plrConsensualRight: null,
  sttLeft: 18,
  sttRight: 12,
  iopLeft: "15.0",
  iopRight: "22.0",
  fluoresceinLeft: false,
  fluoresceinRight: true,
  findingsLeft: null,
  findingsRight: { cornealClarity: "ULCER" },
  diagnoses: ["Corneal ulcer OD"],
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("OphthalmologyExaminationService.create", () => {
  it("creates an exam with per-eye data", async () => {
    mockCreate.mockResolvedValue(baseExam);
    const result = await OphthalmologyExaminationService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      examinedAt: new Date("2026-06-30T10:00:00Z"),
      visionLeft: "NORMAL",
      iopLeft: 15,
      iopRight: 22,
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ iopLeft: 15 }),
      }),
    );
    expect(result.id).toBe("oe-1");
  });
});

describe("OphthalmologyExaminationService.get", () => {
  it("returns exam when found", async () => {
    mockFindFirst.mockResolvedValue(baseExam);
    const result = await OphthalmologyExaminationService.get("oe-1", "org-1");
    expect(result.id).toBe("oe-1");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      OphthalmologyExaminationService.get("oe-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("OphthalmologyExaminationService.list", () => {
  it("returns exams for an organisation", async () => {
    mockFindMany.mockResolvedValue([baseExam]);
    const result = await OphthalmologyExaminationService.list({
      organisationId: "org-1",
    });
    expect(result).toHaveLength(1);
  });
});

describe("OphthalmologyExaminationService.update", () => {
  it("updates IOP values", async () => {
    const updated = { ...baseExam, iopLeft: "18.0", iopRight: "25.0" };
    mockFindFirst.mockResolvedValue(baseExam);
    mockUpdate.mockResolvedValue(updated);
    const result = await OphthalmologyExaminationService.update(
      "oe-1",
      "org-1",
      {
        iopLeft: 18,
        iopRight: 25,
      },
    );
    expect(mockUpdate).toHaveBeenCalled();
    expect(result.iopLeft).toBe("18.0");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      OphthalmologyExaminationService.update("oe-x", "org-1", { notes: "x" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("OphthalmologyExaminationService.delete", () => {
  it("deletes an exam", async () => {
    mockFindFirst.mockResolvedValue(baseExam);
    mockDelete.mockResolvedValue(undefined);
    await OphthalmologyExaminationService.delete("oe-1", "org-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "oe-1" } });
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      OphthalmologyExaminationService.delete("oe-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
