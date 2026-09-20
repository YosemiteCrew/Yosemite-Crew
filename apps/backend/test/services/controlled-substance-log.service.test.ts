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
  // Exactly what `recordControlledSubstanceDispense` writes: the whole draw
  // counted as administered, nothing wasted, and no patient, clinician or waste
  // witness - none of which a stock movement knows. A fixture that carried them
  // could not exercise the fields the amendment path exists to fill in.
  patientId: null,
  administeredBy: null,
  wastedWitness: null,
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

beforeEach(() => {
  jest.clearAllMocks();
  // `clearAllMocks` clears calls but not implementations, so a value one test
  // sets here would otherwise still be the answer several describes later. The
  // amendment path reads this lookup too, so it has to start empty every time.
  mockFindMany.mockResolvedValue([]);
});

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

  // The dispense wrote this row and the stock movement together, so it cannot be
  // corrected by void-and-replace: the reversal would say the whole draw came
  // back while the stock is still out, and the replacement could not carry the
  // linkage anyway - the model's @@unique([sourceEventId, inventoryBatchId])
  // forbids a second row on the pair - so the release that later cancels the
  // draw would never see it. The facts the dispense could not know are amended
  // on the row itself instead, and nothing is appended.
  it("amends a stock-linked entry in place rather than appending a correction", async () => {
    mockLedgerLoad(linkedDispenseEntry);
    mockUpdate.mockResolvedValue({
      ...linkedDispenseEntry,
      patientId: "pat-9",
      amountAdministered: 4,
      amountWasted: 2,
      wastedWitness: "nurse-2",
      administeredBy: "vet-9",
    });

    await expect(
      ControlledSubstanceLogService.update("cs-dispense-1", "org-1", {
        patientId: "pat-9",
        amountAdministered: 4,
        amountWasted: 2,
        wastedWitness: "nurse-2",
        administeredBy: "vet-9",
        correctionReason: "witnessed waste recorded at the cabinet",
      }),
    ).resolves.toMatchObject({ amountAdministered: 4, amountWasted: 2 });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cs-dispense-1" },
        data: expect.objectContaining({
          patientId: "pat-9",
          amountAdministered: 4,
          amountWasted: 2,
          wastedWitness: "nurse-2",
          administeredBy: "vet-9",
        }),
      }),
    );
    // The stock side is not in the patch at all, so nothing can drift into it.
    const { data } = mockUpdate.mock.calls[0][0];
    expect(Object.keys(data).sort()).toEqual([
      "administeredBy",
      "amountAdministered",
      "amountWasted",
      "notes",
      "patientId",
      "wastedWitness",
    ]);
  });

  // An amendment is not a silent edit: the register still shows what the row
  // said before, behind a marker, which is what replaces the struck-through line
  // a paper register would carry.
  it("carries the values an amendment replaces into the entry's notes", async () => {
    mockLedgerLoad(linkedDispenseEntry);
    mockUpdate.mockResolvedValue(linkedDispenseEntry);

    await ControlledSubstanceLogService.update("cs-dispense-1", "org-1", {
      amountAdministered: 4,
      amountWasted: 2,
      wastedWitness: "nurse-2",
      correctionReason: "2ml wasted",
    });

    const { data } = mockUpdate.mock.calls[0][0];
    expect(data.notes).toBe(
      "[amendment:cs-dispense-1] 2ml wasted was amountAdministered=6 amountWasted=0 wastedWitness=none",
    );
  });

  // `assertQuantitiesReconcile` only stops a draw being over-spent; it passes a
  // draw left short. Amendment is the path that lowers administered, so without
  // this the 2ml the clinician did not give simply stops being accounted for.
  it("rejects an amendment that leaves part of the draw unaccounted for", async () => {
    mockLedgerLoad(linkedDispenseEntry);
    await expect(
      ControlledSubstanceLogService.update("cs-dispense-1", "org-1", {
        amountAdministered: 4,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message:
        "Amount administered plus amount wasted must account for the full amount drawn.",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // The must-not-over-block arm for the closure check: an amendment that touches
  // no quantity leaves the dispense's own tuple, which already closes.
  it("accepts an amendment that changes no quantity", async () => {
    mockLedgerLoad(linkedDispenseEntry);
    mockUpdate.mockResolvedValue({
      ...linkedDispenseEntry,
      patientId: "pat-9",
    });

    await expect(
      ControlledSubstanceLogService.update("cs-dispense-1", "org-1", {
        patientId: "pat-9",
      }),
    ).resolves.toMatchObject({ patientId: "pat-9" });
    expect(mockUpdate).toHaveBeenCalled();
  });

  // Nothing in the backend requires a waste witness, and this does not start
  // requiring one everywhere. It requires one where the waste is created: the
  // amendment turns a machine row claiming no waste into one that records some.
  it("rejects an amendment that records waste with no witness", async () => {
    mockLedgerLoad({ ...linkedDispenseEntry, wastedWitness: null });
    await expect(
      ControlledSubstanceLogService.update("cs-dispense-1", "org-1", {
        amountAdministered: 4,
        amountWasted: 2,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message:
        "Recording waste on a controlled substance entry requires a waste witness.",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // The must-not-over-block arm: a witness already on the row satisfies it, so
  // the check reads the resulting entry rather than only the patch.
  it("accepts recorded waste when the entry already carries a witness", async () => {
    mockLedgerLoad({ ...linkedDispenseEntry, wastedWitness: "nurse-1" });
    mockUpdate.mockResolvedValue(linkedDispenseEntry);

    await ControlledSubstanceLogService.update("cs-dispense-1", "org-1", {
      amountAdministered: 4,
      amountWasted: 2,
    });
    expect(mockUpdate).toHaveBeenCalled();
  });

  // Freezing `amountDrawn` is what makes the amendment safe - `reverseDispenseEntry`
  // caps a later release on it - so a caller reaching for it is refused by name
  // rather than quietly ignored.
  it("refuses to change the columns a stock movement owns", async () => {
    mockLedgerLoad(linkedDispenseEntry);
    await expect(
      ControlledSubstanceLogService.update("cs-dispense-1", "org-1", {
        amountDrawn: 100,
        balanceAfter: 0,
        lotNumber: "KET-2026-002",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message:
        "This entry records a stock movement; amountDrawn, balanceAfter, lotNumber cannot be changed from the register. Return or void the dispense instead.",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  // The amended quantities are read against the draw the cabinet actually gave
  // out, not against anything the caller supplied.
  it("rejects an amendment that gives out more than the dispense drew", async () => {
    mockLedgerLoad(linkedDispenseEntry);
    await expect(
      ControlledSubstanceLogService.update("cs-dispense-1", "org-1", {
        amountAdministered: 5,
        amountWasted: 2,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message:
        "Amount administered plus amount wasted cannot exceed amount drawn.",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // A release takes its restored amount out of administered on its own row, so
  // an amendment that also leaves it out subtracts the return twice and the
  // register ends up showing more given back than was ever given. Closure passes
  // on this tuple - 1 + 5 is the full 6 drawn - so this arm can only be caught
  // by the floor, and the 5 witnessed waste it claims is the drug that went back
  // to the cabinet.
  it("refuses an amendment below what a release has already returned", async () => {
    mockLedgerLoad(linkedDispenseEntry);
    mockFindMany.mockResolvedValue([{ amountDrawn: -2 }]);

    await expect(
      ControlledSubstanceLogService.update("cs-dispense-1", "org-1", {
        amountAdministered: 1,
        amountWasted: 5,
        wastedWitness: "nurse-2",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message:
        "Amount administered cannot be below the 2 a release has already returned to stock.",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // The must-not-over-block arm for the floor: the same 2-unit release, and the
  // gross tuple the register expects beside it.
  it("accepts an amendment that closes the draw with a release on the register", async () => {
    mockLedgerLoad(linkedDispenseEntry);
    mockFindMany.mockResolvedValue([{ amountDrawn: -2 }]);
    mockUpdate.mockResolvedValue(linkedDispenseEntry);

    await ControlledSubstanceLogService.update("cs-dispense-1", "org-1", {
      amountAdministered: 5,
      amountWasted: 1,
      wastedWitness: "nurse-2",
    });

    expect(mockUpdate).toHaveBeenCalled();
  });

  // Closure is measured against the whole draw whether or not part of it has
  // come back, so a caller entering the clinical truth net of the return is
  // short by exactly the returned amount. The message has to say so, or the
  // figure it is asking for looks like an invention.
  it("names the returned amount when a release is what closure is missing", async () => {
    mockLedgerLoad(linkedDispenseEntry);
    mockFindMany.mockResolvedValue([{ amountDrawn: -2 }]);

    await expect(
      ControlledSubstanceLogService.update("cs-dispense-1", "org-1", {
        amountAdministered: 3,
        amountWasted: 1,
        wastedWitness: "nurse-2",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message:
        "Amount administered plus amount wasted must account for the full amount drawn." +
        " 2 of it has been returned to stock and is credited back by the release's own entry, so it still counts here.",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // The register is read as a chain, so what has to hold is the net across every
  // row the entry ends up with - not the dispense row on its own. A clinician
  // who gives 3, wastes 1 and returns 2 of a 6-unit draw can do those in either
  // order, and both have to land on the same register.
  describe("a partial return and an amendment, in either order", () => {
    const amendment = {
      amountAdministered: 5,
      amountWasted: 1,
      wastedWitness: "nurse-2",
      correctionReason: "1 wasted witnessed, 2 back to the cabinet",
    };

    const release = () =>
      ControlledSubstanceLogService.reverseDispenseEntry(prisma, {
        organisationId: "org-1",
        sourceEventId: "event-dispense-1",
        inventoryBatchId: "batch-1",
        reversalEventId: "event-release-1",
        amount: 2,
      });

    type QuantityRow = {
      amountDrawn: number;
      amountAdministered: number;
      amountWasted: number;
    };

    const netAcross = (rows: QuantityRow[]) =>
      rows.reduce(
        (total, row) => ({
          amountDrawn: total.amountDrawn + row.amountDrawn,
          amountAdministered: total.amountAdministered + row.amountAdministered,
          amountWasted: total.amountWasted + row.amountWasted,
        }),
        { amountDrawn: 0, amountAdministered: 0, amountWasted: 0 },
      );

    // The amended row keeps the draw the stock movement gave it; only the
    // clinical columns come from the patch.
    const amendedRow = (data: QuantityRow): QuantityRow => ({
      amountDrawn: linkedDispenseEntry.amountDrawn,
      amountAdministered: data.amountAdministered,
      amountWasted: data.amountWasted,
    });

    // 3 into the patient, 1 witnessed waste, 2 back in the cabinet.
    const theRegister = {
      amountDrawn: 4,
      amountAdministered: 3,
      amountWasted: 1,
    };

    it("nets to the same register when the release comes first", async () => {
      mockLedgerLoad(linkedDispenseEntry);
      mockCreate.mockResolvedValue({ id: "cs-reversal-1" });
      await release();
      const reversal = mockCreate.mock.calls[0][0].data;
      // The instrument: an actual reversal row, not an empty one that would net
      // to the dispense on its own.
      expect(reversal.amountDrawn).toBe(-2);

      mockFindMany.mockResolvedValue([{ amountDrawn: reversal.amountDrawn }]);
      mockUpdate.mockResolvedValue(linkedDispenseEntry);
      await ControlledSubstanceLogService.update(
        "cs-dispense-1",
        "org-1",
        amendment,
      );
      const amended = mockUpdate.mock.calls[0][0].data;

      expect(netAcross([amendedRow(amended), reversal])).toEqual(theRegister);
    });

    it("nets to the same register when the amendment comes first", async () => {
      mockLedgerLoad(linkedDispenseEntry);
      mockUpdate.mockResolvedValue(linkedDispenseEntry);
      await ControlledSubstanceLogService.update(
        "cs-dispense-1",
        "org-1",
        amendment,
      );
      const amended = mockUpdate.mock.calls[0][0].data;
      expect(amended.amountAdministered).toBe(5);

      // The row the release reads is now the amended one.
      mockLedgerLoad({ ...linkedDispenseEntry, ...amended });
      mockCreate.mockResolvedValue({ id: "cs-reversal-1" });
      await release();
      const reversal = mockCreate.mock.calls[0][0].data;

      expect(netAcross([amendedRow(amended), reversal])).toEqual(theRegister);
    });
  });

  // The must-not-over-reach arm: a hand-entered entry has no linkage and keeps
  // the append-only correction. Without it the branch could be written to amend
  // every entry in place and nothing here would notice.
  it("still corrects a hand-entered entry by appending, not in place", async () => {
    mockLedgerLoad(baseEntry);
    mockCreate
      .mockResolvedValueOnce(reversalEntry)
      .mockResolvedValueOnce({ ...baseEntry, id: "cs-1-fix" });

    await expect(
      ControlledSubstanceLogService.update("cs-1", "org-1", {
        amountAdministered: 4,
      }),
    ).resolves.toMatchObject({ id: "cs-1-fix" });
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("records the amendment on the audit trail as its own action", async () => {
    mockLedgerLoad(linkedDispenseEntry);
    mockUpdate.mockResolvedValue({
      ...linkedDispenseEntry,
      patientId: "pat-9",
    });

    await ControlledSubstanceLogService.update("cs-dispense-1", "org-1", {
      patientId: "pat-9",
      correctedBy: "vet-7",
    });

    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: "pat-9",
        actorId: "vet-7",
        metadata: expect.objectContaining({
          action: "AMENDMENT",
          amendedEntryId: "cs-dispense-1",
          sourceEventId: "event-dispense-1",
        }),
      }),
    );
  });

  // The reason is free text from the request and can carry patient detail. It
  // belongs on the entry, behind the amendment marker, and the audit event does
  // not need a second independent copy of it.
  it("keeps the amendment reason out of the audit metadata", async () => {
    mockLedgerLoad(linkedDispenseEntry);
    mockUpdate.mockResolvedValue(linkedDispenseEntry);

    await ControlledSubstanceLogService.update("cs-dispense-1", "org-1", {
      administeredBy: "vet-9",
      correctionReason: "given to Bella by Dr Reyes at 14:05",
    });

    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.not.objectContaining({ reason: expect.anything() }),
      }),
    );
    // ...and it is still on the entry, so the reason is recorded, not dropped.
    expect(mockUpdate.mock.calls[0][0].data.notes).toContain(
      "given to Bella by Dr Reyes at 14:05",
    );
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
        "This entry records a stock movement and cannot be voided directly; return or void the dispense instead. Its patient, administration and waste details can still be amended.",
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
  // over - there is no replacement, and the correction path amends this row in
  // place rather than producing one.
  it("refuses a stock-linked void before the already-reversed check", async () => {
    mockLedgerLoad(linkedDispenseEntry, { id: "cs-dispense-1-rev" });
    await expect(
      ControlledSubstanceLogService.delete("cs-dispense-1", "org-1"),
    ).rejects.toMatchObject({
      message:
        "This entry records a stock movement and cannot be voided directly; return or void the dispense instead. Its patient, administration and waste details can still be amended.",
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
