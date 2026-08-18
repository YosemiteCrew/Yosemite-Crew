import { DermatologyAssessmentService } from "../../src/services/dermatology-assessment.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    dermatologyAssessment: {
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

const mockCreate = prisma.dermatologyAssessment.create as jest.Mock;
const mockFindFirst = prisma.dermatologyAssessment.findFirst as jest.Mock;
const mockFindMany = prisma.dermatologyAssessment.findMany as jest.Mock;
const mockUpdate = prisma.dermatologyAssessment.update as jest.Mock;
const mockDelete = prisma.dermatologyAssessment.delete as jest.Mock;

const baseAssessment = {
  id: "da-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: null,
  assessedAt: new Date("2026-06-30T10:00:00Z"),
  assessedBy: "vet-1",
  pruritusScore: 7,
  affectedRegions: ["paws", "face"],
  primaryLesions: ["papule", "pustule"],
  secondaryLesions: ["excoriation", "alopecia"],
  coatQuality: "POOR",
  lesionMap: null,
  environmentalAllergens: ["dust mites"],
  foodTrialStatus: "IN_PROGRESS",
  cades04Score: 28,
  diagnoses: ["Canine atopic dermatitis"],
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("DermatologyAssessmentService.create", () => {
  it("creates an assessment with pruritus and CADESI scores", async () => {
    mockCreate.mockResolvedValue(baseAssessment);
    const result = await DermatologyAssessmentService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      assessedAt: new Date("2026-06-30T10:00:00Z"),
      pruritusScore: 7,
      cades04Score: 28,
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pruritusScore: 7, cades04Score: 28 }),
      }),
    );
    expect(result.pruritusScore).toBe(7);
  });
});

describe("DermatologyAssessmentService.get", () => {
  it("returns assessment when found", async () => {
    mockFindFirst.mockResolvedValue(baseAssessment);
    const result = await DermatologyAssessmentService.get("da-1", "org-1");
    expect(result.id).toBe("da-1");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      DermatologyAssessmentService.get("da-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("DermatologyAssessmentService.list", () => {
  it("returns assessments for a patient", async () => {
    mockFindMany.mockResolvedValue([baseAssessment]);
    await DermatologyAssessmentService.list({
      organisationId: "org-1",
      patientId: "pat-1",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ patientId: "pat-1" }),
      }),
    );
  });
});

describe("DermatologyAssessmentService.update", () => {
  it("updates pruritus score and food trial status", async () => {
    const updated = {
      ...baseAssessment,
      pruritusScore: 4,
      foodTrialStatus: "COMPLETED",
    };
    mockFindFirst.mockResolvedValue(baseAssessment);
    mockUpdate.mockResolvedValue(updated);
    const result = await DermatologyAssessmentService.update("da-1", "org-1", {
      pruritusScore: 4,
      foodTrialStatus: "COMPLETED",
    });
    expect(result.pruritusScore).toBe(4);
    expect(result.foodTrialStatus).toBe("COMPLETED");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      DermatologyAssessmentService.update("da-x", "org-1", { notes: "x" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("DermatologyAssessmentService.delete", () => {
  it("deletes an assessment", async () => {
    mockFindFirst.mockResolvedValue(baseAssessment);
    mockDelete.mockResolvedValue(undefined);
    await DermatologyAssessmentService.delete("da-1", "org-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "da-1" } });
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      DermatologyAssessmentService.delete("da-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
