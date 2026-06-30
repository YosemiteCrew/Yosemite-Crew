import { DentalExaminationService } from "../../src/services/dental-examination.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    dentalExamination: {
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

const mockCreate = prisma.dentalExamination.create as jest.Mock;
const mockFindFirst = prisma.dentalExamination.findFirst as jest.Mock;
const mockFindMany = prisma.dentalExamination.findMany as jest.Mock;
const mockUpdate = prisma.dentalExamination.update as jest.Mock;
const mockDelete = prisma.dentalExamination.delete as jest.Mock;

const baseExam = {
  id: "de-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: null,
  examinedAt: new Date("2026-06-30T10:00:00Z"),
  examinedBy: "vet-1",
  overallGrade: "GRADE_2" as const,
  findings: [{ tooth: "101", condition: "GINGIVITIS", calculus: 2 }],
  calculusScore: 2,
  plaqueScore: 2,
  gingivalScore: 1,
  procedures: ["Scale and polish"],
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("DentalExaminationService.create", () => {
  it("creates an exam with overallGrade", async () => {
    mockCreate.mockResolvedValue(baseExam);
    const result = await DentalExaminationService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      examinedAt: new Date("2026-06-30T10:00:00Z"),
      overallGrade: "GRADE_2",
      findings: [{ tooth: "101", condition: "GINGIVITIS", calculus: 2 }],
      calculusScore: 2,
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ overallGrade: "GRADE_2" }),
      }),
    );
    expect(result.overallGrade).toBe("GRADE_2");
  });
});

describe("DentalExaminationService.get", () => {
  it("returns exam when found", async () => {
    mockFindFirst.mockResolvedValue(baseExam);
    const result = await DentalExaminationService.get("de-1", "org-1");
    expect(result.id).toBe("de-1");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      DentalExaminationService.get("de-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("DentalExaminationService.list", () => {
  it("returns exams for an organisation", async () => {
    mockFindMany.mockResolvedValue([baseExam]);
    const result = await DentalExaminationService.list({
      organisationId: "org-1",
    });
    expect(result).toHaveLength(1);
  });
});

describe("DentalExaminationService.update", () => {
  it("updates the grade", async () => {
    const updated = { ...baseExam, overallGrade: "GRADE_3" as const };
    mockFindFirst.mockResolvedValue(baseExam);
    mockUpdate.mockResolvedValue(updated);
    const result = await DentalExaminationService.update("de-1", "org-1", {
      overallGrade: "GRADE_3",
    });
    expect(result.overallGrade).toBe("GRADE_3");
  });

  it("throws 404 when exam missing", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      DentalExaminationService.update("de-x", "org-1", {
        overallGrade: "GRADE_3",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("DentalExaminationService.delete", () => {
  it("deletes an existing exam", async () => {
    mockFindFirst.mockResolvedValue(baseExam);
    mockDelete.mockResolvedValue(undefined);
    await DentalExaminationService.delete("de-1", "org-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "de-1" } });
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      DentalExaminationService.delete("de-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
