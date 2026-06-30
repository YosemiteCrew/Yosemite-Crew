import { ControlledSubstanceLogService } from "../../src/services/controlled-substance-log.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    controlledSubstanceLog: {
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

const mockCreate = prisma.controlledSubstanceLog.create as jest.Mock;
const mockFindFirst = prisma.controlledSubstanceLog.findFirst as jest.Mock;
const mockFindMany = prisma.controlledSubstanceLog.findMany as jest.Mock;
const mockUpdate = prisma.controlledSubstanceLog.update as jest.Mock;
const mockDelete = prisma.controlledSubstanceLog.delete as jest.Mock;

const baseEntry = {
  id: "cs-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: null,
  loggedAt: new Date("2026-06-30T10:00:00Z"),
  drug: "Ketamine",
  deaSchedule: "III" as const,
  lotNumber: "KET-2026-001",
  strength: 100,
  unit: "MG" as const,
  amountDrawn: 5,
  amountAdministered: 4.5,
  amountWasted: 0.5,
  wastedWitness: "nurse-1",
  balanceBefore: 100,
  balanceAfter: 95,
  administeredBy: "vet-1",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("ControlledSubstanceLogService.create", () => {
  it("creates a log entry with waste and witness", async () => {
    mockCreate.mockResolvedValue(baseEntry);
    const result = await ControlledSubstanceLogService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      loggedAt: new Date("2026-06-30T10:00:00Z"),
      drug: "Ketamine",
      deaSchedule: "III",
      unit: "MG",
      amountDrawn: 5,
      amountAdministered: 4.5,
      amountWasted: 0.5,
      wastedWitness: "nurse-1",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          drug: "Ketamine",
          deaSchedule: "III",
          amountWasted: 0.5,
        }),
      }),
    );
    expect(result.deaSchedule).toBe("III");
    expect(result.amountWasted).toBe(0.5);
  });
});

describe("ControlledSubstanceLogService.get", () => {
  it("returns log entry when found", async () => {
    mockFindFirst.mockResolvedValue(baseEntry);
    const result = await ControlledSubstanceLogService.get("cs-1", "org-1");
    expect(result.id).toBe("cs-1");
    expect(result.wastedWitness).toBe("nurse-1");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      ControlledSubstanceLogService.get("cs-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("ControlledSubstanceLogService.list", () => {
  it("filters by drug and DEA schedule", async () => {
    mockFindMany.mockResolvedValue([baseEntry]);
    await ControlledSubstanceLogService.list({
      organisationId: "org-1",
      drug: "Ketamine",
      deaSchedule: "III",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deaSchedule: "III" }),
      }),
    );
  });
});

describe("ControlledSubstanceLogService.update", () => {
  it("corrects balance fields", async () => {
    const updated = { ...baseEntry, balanceBefore: 105, balanceAfter: 100 };
    mockFindFirst.mockResolvedValue(baseEntry);
    mockUpdate.mockResolvedValue(updated);
    const result = await ControlledSubstanceLogService.update("cs-1", "org-1", {
      balanceBefore: 105,
      balanceAfter: 100,
    });
    expect(result.balanceAfter).toBe(100);
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      ControlledSubstanceLogService.update("cs-x", "org-1", { notes: "x" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("ControlledSubstanceLogService.delete", () => {
  it("deletes an entry", async () => {
    mockFindFirst.mockResolvedValue(baseEntry);
    mockDelete.mockResolvedValue(undefined);
    await ControlledSubstanceLogService.delete("cs-1", "org-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "cs-1" } });
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      ControlledSubstanceLogService.delete("cs-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
