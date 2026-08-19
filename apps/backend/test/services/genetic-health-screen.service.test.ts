import { GeneticHealthScreenService } from "../../src/services/genetic-health-screen.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    geneticHealthScreen: {
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

const mockCreate = prisma.geneticHealthScreen.create as jest.Mock;
const mockFindFirst = prisma.geneticHealthScreen.findFirst as jest.Mock;
const mockFindMany = prisma.geneticHealthScreen.findMany as jest.Mock;
const mockUpdate = prisma.geneticHealthScreen.update as jest.Mock;
const mockDelete = prisma.geneticHealthScreen.delete as jest.Mock;

const baseScreen = {
  id: "ghs-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: null,
  screenedAt: new Date("2026-06-30T10:00:00Z"),
  screenedBy: "vet-1",
  laboratoryName: "Laboklin",
  dnaTests: [
    { disease: "Degenerative Myelopathy", gene: "SOD1", result: "CLEAR" },
    { disease: "Exercise-Induced Collapse", result: "CARRIER" },
  ],
  ofa_hips: "GOOD" as const,
  ofa_elbows: "NORMAL" as const,
  ofa_patellas: null,
  ofa_cardiac: "Normal",
  ofa_eyes: "Unaffected",
  certificateNumber: "GR-12345",
  certificationExpiry: new Date("2028-06-30T00:00:00Z"),
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("GeneticHealthScreenService.create", () => {
  it("creates a screen with DNA tests and OFA ratings", async () => {
    mockCreate.mockResolvedValue(baseScreen);
    const result = await GeneticHealthScreenService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      screenedAt: new Date("2026-06-30T10:00:00Z"),
      ofa_hips: "GOOD",
      dnaTests: [{ disease: "DM", result: "CLEAR" }],
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ofa_hips: "GOOD" }),
      }),
    );
    expect(result.ofa_hips).toBe("GOOD");
  });
});

describe("GeneticHealthScreenService.get", () => {
  it("returns screen when found", async () => {
    mockFindFirst.mockResolvedValue(baseScreen);
    const result = await GeneticHealthScreenService.get("ghs-1", "org-1");
    expect(result.id).toBe("ghs-1");
    expect(result.certificateNumber).toBe("GR-12345");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      GeneticHealthScreenService.get("ghs-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("GeneticHealthScreenService.list", () => {
  it("returns screens for a patient", async () => {
    mockFindMany.mockResolvedValue([baseScreen]);
    await GeneticHealthScreenService.list({
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

describe("GeneticHealthScreenService.update", () => {
  it("updates certificate number and OFA elbow rating", async () => {
    const updated = {
      ...baseScreen,
      certificateNumber: "GR-99999",
      ofa_elbows: "EXCELLENT" as const,
    };
    mockFindFirst.mockResolvedValue(baseScreen);
    mockUpdate.mockResolvedValue(updated);
    const result = await GeneticHealthScreenService.update("ghs-1", "org-1", {
      certificateNumber: "GR-99999",
      ofa_elbows: "EXCELLENT",
    });
    expect(result.certificateNumber).toBe("GR-99999");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      GeneticHealthScreenService.update("ghs-x", "org-1", { notes: "x" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("GeneticHealthScreenService.delete", () => {
  it("deletes a screen", async () => {
    mockFindFirst.mockResolvedValue(baseScreen);
    mockDelete.mockResolvedValue(undefined);
    await GeneticHealthScreenService.delete("ghs-1", "org-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "ghs-1" } });
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      GeneticHealthScreenService.delete("ghs-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
