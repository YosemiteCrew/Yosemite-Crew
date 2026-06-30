import { DrugFormularyService } from "../../src/services/drug-formulary.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    drugFormulary: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    drugFormularyDosage: {
      create: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));

import { prisma } from "src/config/prisma";

const mockCreate = prisma.drugFormulary.create as jest.Mock;
const mockFindFirst = prisma.drugFormulary.findFirst as jest.Mock;
const mockFindMany = prisma.drugFormulary.findMany as jest.Mock;
const mockUpdate = prisma.drugFormulary.update as jest.Mock;
const mockDelete = prisma.drugFormulary.delete as jest.Mock;
const mockDosageCreate = prisma.drugFormularyDosage.create as jest.Mock;
const mockDosageDelete = prisma.drugFormularyDosage.delete as jest.Mock;

const baseDosage = {
  id: "dose-1",
  species: "Canine",
  indication: "Pain management",
  doseMin: 0.05,
  doseMax: 0.1,
  doseUnit: "mg/kg",
  route: "IV",
  frequency: "q4h",
  maxDose: 4,
  notes: null,
};

const baseEntry = {
  id: "df-1",
  organisationId: "org-1",
  drugName: "Buprenorphine",
  genericName: "Buprenorphine HCl",
  category: "ANALGESIC" as const,
  manufacturer: "Reckitt",
  concentration: "0.3mg/mL",
  availableUnits: ["ML"],
  isActive: true,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  dosageEntries: [baseDosage],
};

beforeEach(() => jest.clearAllMocks());

describe("DrugFormularyService.create", () => {
  it("creates an analgesic entry with dosage", async () => {
    mockCreate.mockResolvedValue(baseEntry);
    const result = await DrugFormularyService.create({
      organisationId: "org-1",
      drugName: "Buprenorphine",
      category: "ANALGESIC",
      dosageEntries: [
        { species: "Canine", doseMin: 0.05, doseMax: 0.1, doseUnit: "mg/kg" },
      ],
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          drugName: "Buprenorphine",
          category: "ANALGESIC",
        }),
      }),
    );
    expect(result.category).toBe("ANALGESIC");
    expect(result.dosageEntries).toHaveLength(1);
  });
});

describe("DrugFormularyService.get", () => {
  it("returns entry when found", async () => {
    mockFindFirst.mockResolvedValue(baseEntry);
    const result = await DrugFormularyService.get("df-1", "org-1");
    expect(result.id).toBe("df-1");
    expect(result.drugName).toBe("Buprenorphine");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      DrugFormularyService.get("df-x", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("DrugFormularyService.list", () => {
  it("filters by category", async () => {
    mockFindMany.mockResolvedValue([baseEntry]);
    await DrugFormularyService.list({
      organisationId: "org-1",
      category: "ANALGESIC",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: "ANALGESIC" }),
      }),
    );
  });

  it("filters by search term", async () => {
    mockFindMany.mockResolvedValue([baseEntry]);
    await DrugFormularyService.list({
      organisationId: "org-1",
      search: "Bupren",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              drugName: expect.objectContaining({ contains: "Bupren" }),
            }),
          ]),
        }),
      }),
    );
  });
});

describe("DrugFormularyService.update", () => {
  it("deactivates an entry", async () => {
    const deactivated = { ...baseEntry, isActive: false };
    mockFindFirst.mockResolvedValue(baseEntry);
    mockUpdate.mockResolvedValue(deactivated);
    const result = await DrugFormularyService.update("df-1", "org-1", {
      isActive: false,
    });
    expect(result.isActive).toBe(false);
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      DrugFormularyService.update("df-x", "org-1", { drugName: "x" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("DrugFormularyService.addDosage", () => {
  it("adds a feline dosage entry", async () => {
    const felineDosage = { ...baseDosage, id: "dose-2", species: "Feline" };
    mockFindFirst.mockResolvedValue(baseEntry);
    mockDosageCreate.mockResolvedValue(felineDosage);
    const result = await DrugFormularyService.addDosage("df-1", "org-1", {
      species: "Feline",
      doseMin: 0.02,
      doseMax: 0.05,
      doseUnit: "mg/kg",
    });
    expect(result.species).toBe("Feline");
  });
});

describe("DrugFormularyService.removeDosage", () => {
  it("removes a dosage entry", async () => {
    mockFindFirst.mockResolvedValue(baseEntry);
    mockDosageDelete.mockResolvedValue(undefined);
    await DrugFormularyService.removeDosage("df-1", "dose-1", "org-1");
    expect(mockDosageDelete).toHaveBeenCalledWith({ where: { id: "dose-1" } });
  });
});

describe("DrugFormularyService.delete", () => {
  it("deletes a formulary entry", async () => {
    mockFindFirst.mockResolvedValue(baseEntry);
    mockDelete.mockResolvedValue(undefined);
    await DrugFormularyService.delete("df-1", "org-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "df-1" } });
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      DrugFormularyService.delete("df-x", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
