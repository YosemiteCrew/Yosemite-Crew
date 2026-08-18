import { ControlledSubstanceLogService } from "../../src/services/controlled-substance-log.service";

jest.mock("src/config/prisma", () => {
  const controlledSubstanceLog = {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  return {
    prisma: {
      controlledSubstanceLog,
      $transaction: jest.fn((run: (tx: unknown) => unknown) =>
        run({ controlledSubstanceLog }),
      ),
    },
  };
});

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));

import { prisma } from "src/config/prisma";
import { AuditTrailService } from "../../src/services/audit-trail.service";

const mockCreate = prisma.controlledSubstanceLog.create as jest.Mock;
const mockFindFirst = prisma.controlledSubstanceLog.findFirst as jest.Mock;
const mockFindMany = prisma.controlledSubstanceLog.findMany as jest.Mock;
const mockUpdate = prisma.controlledSubstanceLog.update as jest.Mock;
const mockDelete = prisma.controlledSubstanceLog.delete as jest.Mock;
const mockAudit = AuditTrailService.recordSafely as jest.Mock;

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

// assertRecord loads the entry itself; the append-only guard queries for an
// existing reversal of it, which is the only lookup filtered on notes.
const mockLedgerLoad = (record: unknown, reversal: unknown = null) => {
  mockFindFirst.mockImplementation((args: { where: { notes?: unknown } }) =>
    Promise.resolve(args.where.notes === undefined ? record : reversal),
  );
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

  it("filters by patient and date range, newest entry first", async () => {
    const fromDate = new Date("2026-06-01T00:00:00Z");
    const toDate = new Date("2026-06-30T23:59:59Z");
    mockFindMany.mockResolvedValue([baseEntry]);
    await ControlledSubstanceLogService.list({
      organisationId: "org-1",
      patientId: "pat-1",
      fromDate,
      toDate,
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: "pat-1",
          loggedAt: { gte: fromDate, lte: toDate },
        }),
        orderBy: [{ loggedAt: "desc" }, { createdAt: "desc" }],
      }),
    );
  });
});

describe("ControlledSubstanceLogService.update", () => {
  const reversalEntry = {
    ...baseEntry,
    id: "cs-1-rev",
    amountDrawn: -5,
    amountAdministered: -4.5,
    amountWasted: -0.5,
    balanceBefore: 95,
    balanceAfter: 100,
    notes: "[reversal:cs-1]",
  };

  it("corrects balance fields by appending, never by mutating history", async () => {
    const correction = {
      ...baseEntry,
      id: "cs-2",
      balanceBefore: 105,
      balanceAfter: 100,
    };
    mockLedgerLoad(baseEntry);
    mockCreate
      .mockResolvedValueOnce(reversalEntry)
      .mockResolvedValueOnce(correction);

    const result = await ControlledSubstanceLogService.update("cs-1", "org-1", {
      balanceBefore: 105,
      balanceAfter: 100,
    });

    expect(result.id).toBe("cs-2");
    expect(result.balanceAfter).toBe(100);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("cannot erase an earlier record: the original quantities survive in the appended reversal", async () => {
    const correction = { ...baseEntry, id: "cs-2", amountAdministered: 1 };
    mockLedgerLoad(baseEntry);
    mockCreate
      .mockResolvedValueOnce(reversalEntry)
      .mockResolvedValueOnce(correction);

    await ControlledSubstanceLogService.update("cs-1", "org-1", {
      amountAdministered: 1,
      amountWasted: 4,
      correctionReason: "wrong volume recorded",
      correctedBy: "vet-2",
    });

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledTimes(2);

    // The reversal carries the exact negation of the entry it cancels, so the
    // pre-correction figures remain reconstructable from the ledger.
    expect(mockCreate.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        amountDrawn: -5,
        amountAdministered: -4.5,
        amountWasted: -0.5,
        balanceBefore: 95,
        balanceAfter: 100,
        notes: "[reversal:cs-1] wrong volume recorded",
      }),
    );
    expect(mockCreate.mock.calls[1][0].data).toEqual(
      expect.objectContaining({
        amountDrawn: 5,
        amountAdministered: 1,
        amountWasted: 4,
        loggedAt: baseEntry.loggedAt,
        notes: "[correction:cs-1] wrong volume recorded",
      }),
    );
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "vet-2",
        entityId: "cs-2",
        metadata: expect.objectContaining({
          action: "CORRECTION",
          correctedEntryId: "cs-1",
          reversalEntryId: "cs-1-rev",
          reason: "wrong volume recorded",
        }),
      }),
    );
  });

  it("applies a reconciling amount correction", async () => {
    const correction = {
      ...baseEntry,
      id: "cs-2",
      amountDrawn: 6,
      amountAdministered: 5,
    };
    mockLedgerLoad(baseEntry);
    mockCreate
      .mockResolvedValueOnce(reversalEntry)
      .mockResolvedValueOnce(correction);

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

    expect(mockCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lotNumber: "KET-2026-002",
          strength: 120,
          amountDrawn: 6,
          amountWasted: 1,
          wastedWitness: "nurse-2",
          administeredBy: "vet-2",
          notes: "[correction:cs-1] corrected after recount",
        }),
      }),
    );
    expect(result.amountAdministered).toBe(5);
  });

  it("carries the entry notes forward when the correction supplies none", async () => {
    mockLedgerLoad({
      ...baseEntry,
      patientId: null,
      administeredBy: null,
      notes: "given during induction",
    });
    mockCreate
      .mockResolvedValueOnce(reversalEntry)
      .mockResolvedValueOnce(baseEntry);

    await ControlledSubstanceLogService.update("cs-1", "org-1", {
      strength: 150,
    });

    expect(mockCreate.mock.calls[0][0].data.notes).toBe("[reversal:cs-1]");
    expect(mockCreate.mock.calls[1][0].data.notes).toBe(
      "[correction:cs-1] given during induction",
    );
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: "", actorId: null }),
    );
  });

  it("rejects correcting an entry that has already been reversed", async () => {
    mockLedgerLoad(baseEntry, { id: "cs-1-rev" });
    await expect(
      ControlledSubstanceLogService.update("cs-1", "org-1", { strength: 150 }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message:
        "This controlled substance log entry has already been reversed; correct the replacement entry instead.",
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects a patch that makes administered exceed the stored drawn amount", async () => {
    mockLedgerLoad(baseEntry);
    await expect(
      ControlledSubstanceLogService.update("cs-1", "org-1", {
        amountAdministered: 100,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message:
        "Amount administered plus amount wasted cannot exceed amount drawn.",
    });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects a patch that lowers drawn below the stored administered amount", async () => {
    mockLedgerLoad(baseEntry);
    await expect(
      ControlledSubstanceLogService.update("cs-1", "org-1", {
        amountDrawn: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects a balance correction that no longer reconciles", async () => {
    mockLedgerLoad(baseEntry);
    await expect(
      ControlledSubstanceLogService.update("cs-1", "org-1", {
        balanceAfter: 80,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Balance after must equal balance before minus amount drawn.",
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      ControlledSubstanceLogService.update("cs-x", "org-1", { notes: "x" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("ControlledSubstanceLogService.delete", () => {
  const reversalEntry = {
    ...baseEntry,
    id: "cs-1-rev",
    amountDrawn: -5,
    amountAdministered: -4.5,
    amountWasted: -0.5,
    balanceBefore: 95,
    balanceAfter: 100,
    notes: "[reversal:cs-1] drawn in error",
  };

  it("voids an entry by appending its reversal instead of deleting it", async () => {
    mockLedgerLoad(baseEntry);
    mockCreate.mockResolvedValue(reversalEntry);

    const result = await ControlledSubstanceLogService.delete("cs-1", "org-1", {
      voidedBy: "vet-2",
      reason: "drawn in error",
    });

    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(result.id).toBe("cs-1-rev");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          drug: "Ketamine",
          amountDrawn: -5,
          amountAdministered: -4.5,
          amountWasted: -0.5,
          balanceBefore: 95,
          balanceAfter: 100,
          notes: "[reversal:cs-1] drawn in error",
        }),
      }),
    );
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "vet-2",
        entityId: "cs-1-rev",
        metadata: expect.objectContaining({
          action: "VOID",
          voidedEntryId: "cs-1",
          reason: "drawn in error",
        }),
      }),
    );
  });

  it("falls back to the logging clinician when no actor or reason is supplied", async () => {
    mockLedgerLoad(baseEntry);
    mockCreate.mockResolvedValue({
      ...reversalEntry,
      notes: "[reversal:cs-1]",
    });

    await ControlledSubstanceLogService.delete("cs-1", "org-1");

    expect(mockCreate.mock.calls[0][0].data.notes).toBe("[reversal:cs-1]");
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "vet-1",
        metadata: expect.not.objectContaining({ reason: expect.anything() }),
      }),
    );
  });

  it("records a null actor when the voided entry has no clinician or patient", async () => {
    mockLedgerLoad({ ...baseEntry, patientId: null, administeredBy: null });
    mockCreate.mockResolvedValue(reversalEntry);

    await ControlledSubstanceLogService.delete("cs-1", "org-1");

    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: "", actorId: null }),
    );
  });

  it("rejects voiding an entry that has already been reversed", async () => {
    mockLedgerLoad(baseEntry, { id: "cs-1-rev" });
    await expect(
      ControlledSubstanceLogService.delete("cs-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
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
