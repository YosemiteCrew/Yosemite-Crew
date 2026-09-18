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

// What the dispense path writes: the register half of a stock movement, carrying
// the consumption event and batch it came from. `baseEntry` is the hand-entered
// shape, which stores no linkage.
const linkedDispenseEntry = {
  ...baseEntry,
  id: "cs-dispense-1",
  amountDrawn: 6,
  amountAdministered: 6,
  amountWasted: 0,
  balanceBefore: 10,
  balanceAfter: 4,
  sourceEventId: "event-dispense-1",
  inventoryBatchId: "batch-1",
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

  // The dispense wrote this row and the stock movement together, so a ledger-only
  // correction would move the register and leave the cabinet where it was. Notes
  // are the most innocuous patch there is and it is still refused: the correction
  // appends a REPLACEMENT entry that cannot carry the stock linkage - the model's
  // @@unique([sourceEventId, inventoryBatchId]) forbids a second row on the pair -
  // so the replacement is invisible to the release that later cancels the draw.
  it("rejects correcting an entry that records a stock movement", async () => {
    mockLedgerLoad(linkedDispenseEntry);
    await expect(
      ControlledSubstanceLogService.update("cs-1", "org-1", {
        notes: "witness misspelled",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message:
        "This entry records a stock movement and cannot be voided or corrected directly; return or void the dispense instead.",
    });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  // Pins the ordering: the caller is told it is on the wrong path, not that its
  // arithmetic is wrong on a row it may not amend at all.
  it("refuses a stock-linked correction before checking the quantities", async () => {
    mockLedgerLoad(linkedDispenseEntry);
    await expect(
      ControlledSubstanceLogService.update("cs-1", "org-1", {
        amountAdministered: 100,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message:
        "This entry records a stock movement and cannot be voided or corrected directly; return or void the dispense instead.",
    });
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

  // The void writes no stock movement, so voiding the register half of a dispense
  // leaves the register saying the drug is back and the cabinet saying it is out.
  // A later release of that stock then reads the entry as never restored and
  // credits the whole draw back a second time.
  it("rejects voiding an entry that records a stock movement", async () => {
    mockLedgerLoad(linkedDispenseEntry);
    await expect(
      ControlledSubstanceLogService.delete("cs-dispense-1", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 409,
      message:
        "This entry records a stock movement and cannot be voided or corrected directly; return or void the dispense instead.",
    });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  // A release's own reversal is machine-written too and carries the release event,
  // so the same guard stops a void from flipping a credit back into a debit. This
  // is why the guard keys on the linkage rather than on the sign of the draw.
  it("rejects voiding the reversal row a release wrote", async () => {
    mockLedgerLoad({
      ...linkedDispenseEntry,
      id: "cs-release-rev",
      amountDrawn: -6,
      amountAdministered: -6,
      balanceBefore: 4,
      balanceAfter: 10,
      notes: "[reversal:cs-dispense-1]",
      sourceEventId: "event-release-1",
    });
    await expect(
      ControlledSubstanceLogService.delete("cs-release-rev", "org-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  // The must-not-over-block arm: a hand-entered entry stores an explicit null and
  // stays voidable. Without it the guard could be written as a presence check on
  // the key and nothing would notice.
  it("still voids a hand-entered entry whose stock linkage is null", async () => {
    mockLedgerLoad({
      ...baseEntry,
      sourceEventId: null,
      inventoryBatchId: null,
    });
    mockCreate.mockResolvedValue(reversalEntry);

    await expect(
      ControlledSubstanceLogService.delete("cs-1", "org-1"),
    ).resolves.toMatchObject({ id: "cs-1-rev" });
    expect(mockCreate).toHaveBeenCalled();
  });

  // Ordering: a partly released dispense is refused as stock-linked rather than
  // told to "correct the replacement entry instead", advice that is wrong twice
  // over - there is no replacement, and correcting is refused as well.
  it("refuses a stock-linked void before the already-reversed check", async () => {
    mockLedgerLoad(linkedDispenseEntry, { id: "cs-dispense-1-rev" });
    await expect(
      ControlledSubstanceLogService.delete("cs-dispense-1", "org-1"),
    ).rejects.toMatchObject({
      message:
        "This entry records a stock movement and cannot be voided or corrected directly; return or void the dispense instead.",
    });
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

describe("ControlledSubstanceLogService.reverseDispenseEntry", () => {
  // 6 units drawn against an on-hand of 10, so the register closed at 4.
  const dispenseEntry = {
    ...baseEntry,
    id: "cs-dispense-1",
    amountDrawn: 6,
    amountAdministered: 6,
    amountWasted: 0,
    balanceBefore: 10,
    balanceAfter: 4,
    sourceEventId: "event-dispense-1",
    inventoryBatchId: "batch-1",
  };

  const reverse = (amount: number, reversalEventId = "event-release-1") =>
    ControlledSubstanceLogService.reverseDispenseEntry(prisma, {
      organisationId: "org-1",
      sourceEventId: "event-dispense-1",
      inventoryBatchId: "batch-1",
      reversalEventId,
      amount,
    });

  const writtenData = () => mockCreate.mock.calls[0][0].data;

  beforeEach(() => {
    mockFindFirst.mockResolvedValue(dispenseEntry);
    mockFindMany.mockResolvedValue([]);
    mockCreate.mockResolvedValue({ id: "cs-reversal-1" });
  });

  it("opens the first reversal at the balance the dispense closed on", async () => {
    await reverse(2);

    expect(writtenData()).toMatchObject({
      amountDrawn: -2,
      amountAdministered: -2,
      balanceBefore: 4,
      balanceAfter: 6,
    });
  });

  // The regression. Both rows describe the same dispense, so a reversal that
  // reads only that dispense opens the second row at 4 again and the register
  // reads 4 -> 6 then 4 -> 5 rather than 4 -> 6 then 6 -> 7.
  it("opens a later reversal where the previous one closed", async () => {
    mockFindMany.mockResolvedValue([{ amountDrawn: -2 }]);

    await reverse(1, "event-release-2");

    expect(writtenData()).toMatchObject({
      amountDrawn: -1,
      balanceBefore: 6,
      balanceAfter: 7,
    });
  });

  it("chains across more than two releases", async () => {
    mockFindMany.mockResolvedValue([{ amountDrawn: -2 }, { amountDrawn: -1 }]);

    await reverse(3, "event-release-3");

    expect(writtenData()).toMatchObject({
      amountDrawn: -3,
      balanceBefore: 7,
      balanceAfter: 10,
    });
  });

  // A per-reversal cap lets each release restore up to the whole original draw,
  // so three releases of 6 would credit 18 units back against a 6-unit draw.
  it("caps a release at what is left of the original draw, not at the draw", async () => {
    mockFindMany.mockResolvedValue([{ amountDrawn: -4 }]);

    await reverse(6, "event-release-2");

    expect(writtenData()).toMatchObject({
      amountDrawn: -2,
      balanceBefore: 8,
      balanceAfter: 10,
    });
  });

  it("writes nothing once the draw is fully reversed", async () => {
    mockFindMany.mockResolvedValue([{ amountDrawn: -6 }]);

    await expect(reverse(2, "event-release-2")).resolves.toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  // 0.01 + 0.09 sums to 0.09999999999999999, so a 0.1 draw reversed in those
  // two steps leaves 1.4e-17 - positive, so a `> 0` guard would write a row
  // restoring nothing measurable, and only the tolerance rejects it. The
  // fixture has to land on the positive side: equal totals cancel to exactly 0
  // and would be rejected either way, which is no test of the tolerance at all.
  it("writes nothing when only a float residue of the draw is left", async () => {
    mockFindFirst.mockResolvedValue({ ...dispenseEntry, amountDrawn: 0.1 });
    mockFindMany.mockResolvedValue([
      { amountDrawn: -0.01 },
      { amountDrawn: -0.09 },
    ]);

    await expect(reverse(0.05, "event-release-2")).resolves.toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("keeps the balance columns null when the dispense recorded none", async () => {
    mockFindFirst.mockResolvedValue({
      ...dispenseEntry,
      balanceBefore: null,
      balanceAfter: null,
    });
    mockFindMany.mockResolvedValue([{ amountDrawn: -2 }]);

    await reverse(1, "event-release-2");

    expect(writtenData()).toMatchObject({
      amountDrawn: -1,
      balanceBefore: null,
      balanceAfter: null,
    });
  });

  it("looks prior reversals up by the marker that names this dispense", async () => {
    await reverse(2);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: "org-1",
          notes: { startsWith: "[reversal:cs-dispense-1]" },
        }),
      }),
    );
  });

  // `update` (a correction) and `delete` (a void) each append a FULL reversal
  // carrying this same marker and no stock event. Counting one of those reads
  // the entire draw as already restored, so a later release moves the stock and
  // writes nothing at all in the register - the divergence the cap exists to
  // prevent, arriving by the cap itself.
  it("counts only the reversals a release wrote, not a correction's or a void's", async () => {
    await reverse(2);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sourceEventId: { not: null },
        }),
      }),
    );
  });

  it("returns null without querying reversals when no dispense entry exists", async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(reverse(2)).resolves.toBeNull();
    expect(mockFindMany).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
