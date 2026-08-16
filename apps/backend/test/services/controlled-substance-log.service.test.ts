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

  it("accepts an entry where administered plus wasted exactly equals drawn", async () => {
    mockCreate.mockResolvedValue(baseEntry);
    await ControlledSubstanceLogService.create({
      organisationId: "org-1",
      loggedAt: new Date("2026-06-30T10:00:00Z"),
      drug: "Ketamine",
      deaSchedule: "III",
      unit: "MG",
      amountDrawn: 5,
      amountAdministered: 4.5,
      amountWasted: 0.5,
      balanceBefore: 100,
      balanceAfter: 95,
    });
    expect(mockCreate).toHaveBeenCalled();
  });

  it("rejects an entry where administered exceeds drawn", async () => {
    await expect(
      ControlledSubstanceLogService.create({
        organisationId: "org-1",
        loggedAt: new Date("2026-06-30T10:00:00Z"),
        drug: "Ketamine",
        deaSchedule: "III",
        unit: "MG",
        amountDrawn: 1,
        amountAdministered: 100,
      }),
    ).rejects.toMatchObject({
      name: "ControlledSubstanceLogError",
      statusCode: 400,
      message:
        "Amount administered plus amount wasted cannot exceed amount drawn.",
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects an entry where administered plus wasted exceeds drawn", async () => {
    await expect(
      ControlledSubstanceLogService.create({
        organisationId: "org-1",
        loggedAt: new Date("2026-06-30T10:00:00Z"),
        drug: "Ketamine",
        deaSchedule: "III",
        unit: "MG",
        amountDrawn: 5,
        amountAdministered: 4.5,
        amountWasted: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects an entry whose balance after does not reconcile with amount drawn", async () => {
    await expect(
      ControlledSubstanceLogService.create({
        organisationId: "org-1",
        loggedAt: new Date("2026-06-30T10:00:00Z"),
        drug: "Ketamine",
        deaSchedule: "III",
        unit: "MG",
        amountDrawn: 5,
        amountAdministered: 5,
        balanceBefore: 100,
        balanceAfter: 80,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Balance after must equal balance before minus amount drawn.",
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("skips the balance check when only one balance is supplied", async () => {
    mockCreate.mockResolvedValue(baseEntry);
    await ControlledSubstanceLogService.create({
      organisationId: "org-1",
      loggedAt: new Date("2026-06-30T10:00:00Z"),
      drug: "Ketamine",
      deaSchedule: "III",
      unit: "MG",
      amountDrawn: 5,
      amountAdministered: 5,
      balanceBefore: 100,
    });
    expect(mockCreate).toHaveBeenCalled();
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

  it("applies a reconciling amount correction", async () => {
    const updated = { ...baseEntry, amountDrawn: 6, amountAdministered: 5 };
    mockFindFirst.mockResolvedValue(baseEntry);
    mockUpdate.mockResolvedValue(updated);
    const result = await ControlledSubstanceLogService.update("cs-1", "org-1", {
      lotNumber: "KET-2026-002",
      strength: 120,
      amountDrawn: 6,
      amountAdministered: 5,
      amountWasted: 1,
      wastedWitness: "nurse-2",
      balanceAfter: 94,
      administeredBy: "vet-2",
      notes: "corrected after recount",
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amountDrawn: 6, amountWasted: 1 }),
      }),
    );
    expect(result.amountAdministered).toBe(5);
  });

  it("rejects a patch that makes administered exceed the stored drawn amount", async () => {
    mockFindFirst.mockResolvedValue(baseEntry);
    await expect(
      ControlledSubstanceLogService.update("cs-1", "org-1", {
        amountAdministered: 100,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message:
        "Amount administered plus amount wasted cannot exceed amount drawn.",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects a patch that lowers drawn below the stored administered amount", async () => {
    mockFindFirst.mockResolvedValue(baseEntry);
    await expect(
      ControlledSubstanceLogService.update("cs-1", "org-1", {
        amountDrawn: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects a balance correction that no longer reconciles", async () => {
    mockFindFirst.mockResolvedValue(baseEntry);
    await expect(
      ControlledSubstanceLogService.update("cs-1", "org-1", {
        balanceAfter: 80,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Balance after must equal balance before minus amount drawn.",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
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
