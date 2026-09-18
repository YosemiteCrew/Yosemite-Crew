import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class ControlledSubstanceLogError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ControlledSubstanceLogError";
  }
}

export type DeaSchedule = "II" | "III" | "IV" | "V";
export type DrugUnit =
  "ML" | "MG" | "MCG" | "TABLET" | "CAPSULE" | "PATCH" | "UNIT";

// The dispense and void paths already run inside prisma.$transaction, so every
// write here has to be able to run on the caller's client. Writing through the
// module-global client from inside someone else's transaction would put the
// register entry on a second connection that the caller's rollback cannot
// reach - which is how a dispense that failed leaves a register entry behind.
type CsLogClient = typeof prisma | Prisma.TransactionClient;

export interface CreateCsLogParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  loggedAt: Date;
  drug: string;
  deaSchedule: DeaSchedule;
  lotNumber?: string;
  strength?: number;
  unit: DrugUnit;
  amountDrawn: number;
  amountAdministered: number;
  amountWasted?: number;
  wastedWitness?: string;
  balanceBefore?: number;
  balanceAfter?: number;
  administeredBy?: string;
  notes?: string;
  // Set only by the dispense and void paths: the InventoryConsumptionEvent that
  // moved the stock, and the batch it was drawn from. Unique as a pair, so a
  // replayed dispense cannot enter one movement in the register twice.
  sourceEventId?: string;
  inventoryBatchId?: string;
}

// `patientId` is deliberately not in this list: the dispense path has no patient
// to hand and leaves it null, and a register entry with no patient on it is not
// a record of anything.
export type UpdateCsLogParams = Partial<
  Omit<
    CreateCsLogParams,
    | "organisationId"
    | "loggedAt"
    | "drug"
    | "deaSchedule"
    | "unit"
    // A correction adjusts quantities and notes. It must never re-point an
    // entry at a different stock movement.
    | "sourceEventId"
    | "inventoryBatchId"
  >
> & {
  correctedBy?: string;
  correctionReason?: string;
};

export interface VoidCsLogParams {
  voidedBy?: string;
  reason?: string;
}

export interface ListCsLogParams {
  organisationId: string;
  patientId?: string;
  drug?: string;
  deaSchedule?: DeaSchedule;
  fromDate?: Date;
  toDate?: Date;
}

const csLogSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  loggedAt: true,
  drug: true,
  deaSchedule: true,
  lotNumber: true,
  strength: true,
  unit: true,
  amountDrawn: true,
  amountAdministered: true,
  amountWasted: true,
  wastedWitness: true,
  balanceBefore: true,
  balanceAfter: true,
  administeredBy: true,
  notes: true,
  sourceEventId: true,
  inventoryBatchId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ControlledSubstanceLogSelect;

// Quantities are stored as floats, so reconcile with a small tolerance instead
// of exact equality.
export const QUANTITY_TOLERANCE = 1e-6;

const assertQuantitiesReconcile = (quantities: {
  amountDrawn: number;
  amountAdministered: number;
  amountWasted: number;
  balanceBefore: number | null;
  balanceAfter: number | null;
}) => {
  const {
    amountDrawn,
    amountAdministered,
    amountWasted,
    balanceBefore,
    balanceAfter,
  } = quantities;

  if (amountAdministered + amountWasted > amountDrawn + QUANTITY_TOLERANCE) {
    throw new ControlledSubstanceLogError(
      "Amount administered plus amount wasted cannot exceed amount drawn.",
      400,
    );
  }

  if (balanceBefore === null || balanceAfter === null) return;

  if (
    Math.abs(balanceBefore - amountDrawn - balanceAfter) > QUANTITY_TOLERANCE
  ) {
    throw new ControlledSubstanceLogError(
      "Balance after must equal balance before minus amount drawn.",
      400,
    );
  }
};

// The ledger is append-only for everything that moves stock: no entry's drawn
// amount, balances or stock linkage is ever mutated or deleted. A correction
// appends a reversing entry (every quantity negated) followed by a replacement
// entry, and a void appends the reversing entry alone, so the original row and
// the balances it carries stay readable and reconcilable forever. The trailing
// `]` in the marker keeps `startsWith` from matching a longer id.
//
// The one exception is an entry the dispense path wrote. It cannot be corrected
// that way - its reversal would say the whole draw came back while the stock is
// still out - so the clinical facts the dispense could not know are amended on
// the row itself, and the values they replace are carried in `notes` behind an
// amendment marker rather than lost. See `amendStockLinkedEntry`.
const reversalMarker = (sourceId: string) => `[reversal:${sourceId}]`;
const correctionMarker = (sourceId: string) => `[correction:${sourceId}]`;
const amendmentMarker = (sourceId: string) => `[amendment:${sourceId}]`;

const buildLedgerNote = (
  marker: string,
  reason?: string | null,
  carriedNotes?: string | null,
) =>
  [marker, reason, carriedNotes]
    .filter((part): part is string => Boolean(part))
    .join(" ");

const assertRecord = async (
  id: string,
  organisationId: string,
  client: CsLogClient = prisma,
) => {
  const record = await client.controlledSubstanceLog.findFirst({
    where: { id, organisationId },
    select: csLogSelect,
  });
  if (!record) {
    throw new ControlledSubstanceLogError(
      "Controlled substance log entry not found.",
      404,
    );
  }
  return record;
};

type CsLogRecord = Prisma.ControlledSubstanceLogGetPayload<{
  select: typeof csLogSelect;
}>;

// A reversal is the exact algebraic negation of an entry that already passed
// `assertQuantitiesReconcile`, so it nets that entry to zero without being
// re-validated: the forward-direction invariant (administered + wasted never
// exceeds drawn) does not survive negation when the original left any slack.
const buildReversalData = (
  record: CsLogRecord,
  notes: string,
  // Never inherited from the entry being reversed: the pair is unique, and a
  // reversal is caused by its own stock movement rather than by the one it
  // cancels. A hand-entered correction or void passes nothing and gets nulls.
  linkage: {
    sourceEventId?: string | null;
    inventoryBatchId?: string | null;
  } = {},
): Prisma.ControlledSubstanceLogCreateInput => ({
  organisationId: record.organisationId,
  patientId: record.patientId,
  encounterId: record.encounterId,
  loggedAt: record.loggedAt,
  drug: record.drug,
  deaSchedule: record.deaSchedule,
  lotNumber: record.lotNumber,
  strength: record.strength,
  unit: record.unit,
  amountDrawn: -record.amountDrawn,
  amountAdministered: -record.amountAdministered,
  amountWasted: -record.amountWasted,
  wastedWitness: record.wastedWitness,
  balanceBefore: record.balanceAfter,
  balanceAfter: record.balanceBefore,
  administeredBy: record.administeredBy,
  notes,
  sourceEventId: linkage.sourceEventId ?? null,
  inventoryBatchId: linkage.inventoryBatchId ?? null,
});

const assertNotReversed = async (
  client: Prisma.TransactionClient,
  record: CsLogRecord,
) => {
  const reversal = await client.controlledSubstanceLog.findFirst({
    where: {
      organisationId: record.organisationId,
      notes: { startsWith: reversalMarker(record.id) },
    },
    select: { id: true },
  });
  if (reversal) {
    throw new ControlledSubstanceLogError(
      "This controlled substance log entry has already been reversed; correct the replacement entry instead.",
      409,
    );
  }
};

// Everything releases have already credited back against this entry, summed off
// the reversal rows they wrote and found by the marker their notes start with -
// the same link `assertNotReversed` uses. Two paths need this one number for
// opposite reasons: a release caps itself on what is left of the draw, and an
// amendment may not lower administered below what has already come back.
//
// Only the reversals a RELEASE wrote. `assertNotStockLinked` refuses a hand void
// or correction of a stock-linked entry, so no hand reversal can carry this
// marker; the clause states that invariant rather than depending on it. Were one
// to exist, counting it would read the draw as already restored and a later
// partial release would move the stock while the register stayed silent.
const sumRestoredByReleases = async (
  client: CsLogClient,
  record: Pick<CsLogRecord, "id" | "organisationId">,
) => {
  const priorReversals = await client.controlledSubstanceLog.findMany({
    where: {
      organisationId: record.organisationId,
      notes: { startsWith: reversalMarker(record.id) },
      sourceEventId: { not: null },
    },
    select: { amountDrawn: true },
  });
  // A reversal stores its restored amount negated, so subtracting sums them.
  return priorReversals.reduce(
    (total, reversal) => total - reversal.amountDrawn,
    0,
  );
};

// Quantities are floats, so a sum of them can carry a 1e-16 tail that has no
// business in a message a clinician reads.
const formatQuantity = (amount: number) => Number(amount.toFixed(6)).toString();

// A register row the dispense path wrote is half of an atomic pair whose other
// half is the stock movement, so voiding it from the ledger side alone credits
// the register without moving the cabinet. Refused, and the caller is pointed at
// the stock path, which reverses both together. Truthiness rather than a null
// comparison: a hand-entered entry stores null here and a record that omits the
// column must read as unlinked too.
const assertNotStockLinked = (record: CsLogRecord) => {
  if (!record.sourceEventId) return;
  throw new ControlledSubstanceLogError(
    "This entry records a stock movement and cannot be voided directly; return or void the dispense instead. Its patient, administration and waste details can still be amended.",
    409,
  );
};

// What a dispense writes about a draw it did not witness: the whole quantity as
// administered, nothing wasted, and no patient, clinician or waste witness. Each
// of these is a clinical fact the stock movement cannot supply, so each is
// amendable on the row afterwards. Everything outside this set either moves
// stock or identifies the movement, and stays frozen - `reverseDispenseEntry`
// caps a later release on `amountDrawn`, and the balances are what makes the
// register reconcile.
const AMENDABLE_ON_STOCK_LINKED = [
  "patientId",
  "amountAdministered",
  "amountWasted",
  "wastedWitness",
  "administeredBy",
  "notes",
] as const;

type AmendableField = (typeof AMENDABLE_ON_STOCK_LINKED)[number];

const assertOnlyAmendable = (params: UpdateCsLogParams) => {
  const amendable = new Set<string>(AMENDABLE_ON_STOCK_LINKED);
  // `correctedBy` and `correctionReason` describe the amendment rather than the
  // entry, so they are never part of the frozen set.
  const describes = new Set(["correctedBy", "correctionReason"]);
  // Named in a stable order, so the message a caller sees does not depend on the
  // order the keys happened to arrive in.
  const frozen = Object.keys(params)
    .filter(
      (field) =>
        params[field as keyof UpdateCsLogParams] !== undefined &&
        !amendable.has(field) &&
        !describes.has(field),
    )
    .sort((left, right) => left.localeCompare(right));
  if (frozen.length === 0) return;
  throw new ControlledSubstanceLogError(
    `This entry records a stock movement; ${frozen.join(", ")} cannot be changed from the register. Return or void the dispense instead.`,
    409,
  );
};

// The values an amendment replaces, written into the entry's own notes so the
// register still shows what it said before - the ledger equivalent of a struck
// through line, and the reason an in-place amendment is not a silent edit.
const describeReplaced = (
  existing: CsLogRecord,
  params: UpdateCsLogParams,
): string | null => {
  const replaced = AMENDABLE_ON_STOCK_LINKED.filter(
    (field): field is Exclude<AmendableField, "notes"> => field !== "notes",
  )
    // `null` on the record and `undefined` in the patch both mean "not set", so
    // normalise before comparing - otherwise clearing a column that was already
    // empty would read as a change worth recording.
    .map((field) => ({
      field,
      was: existing[field] ?? undefined,
      now: params[field],
    }))
    .filter(({ was, now }) => now !== undefined && now !== was)
    .map(({ field, was }) => `${field}=${was ?? "none"}`);
  return replaced.length > 0 ? `was ${replaced.join(" ")}` : null;
};

// The tuple an amendment would leave on the row: the amended clinical facts read
// against the draw and balances the stock movement owns and this path cannot
// touch.
const amendedTuple = (existing: CsLogRecord, params: UpdateCsLogParams) => ({
  amountAdministered: params.amountAdministered ?? existing.amountAdministered,
  amountWasted: params.amountWasted ?? existing.amountWasted,
  wastedWitness: params.wastedWitness ?? existing.wastedWitness,
});

// Every unit drawn has to end up somewhere the register can name: into the
// patient, into witnessed waste, or back in the cabinet behind a release's own
// reversal row. `assertQuantitiesReconcile` is one-sided - it stops a draw being
// over-spent and passes a draw left short - and amendment is the path that lowers
// administered, so here the slack is the whole point: 6 drawn and 4 administered
// means 2 of a controlled drug went somewhere, and the register has to say where.
const assertDrawIsAccountedFor = (
  existing: CsLogRecord,
  tuple: ReturnType<typeof amendedTuple>,
  alreadyRestored: number,
) => {
  const { amountAdministered, amountWasted } = tuple;

  // Closure is measured against the whole draw, not against the draw less what
  // a release has returned, because a release does not leave its restored amount
  // out of this row - `reverseDispenseEntry` writes `-restored` into its own
  // row's administered as well as its drawn. So this row stays a gross statement
  // of the draw and the register nets it with the reversal beside it: 6 drawn
  // with 5 administered and 1 wasted, less a 2-unit release, reads as 4 out, 3
  // administered, 1 wasted. Netting the target here instead would subtract the
  // return twice. The message names the returned amount, because that is the
  // figure a caller looking at the clinical truth is missing.
  if (
    Math.abs(amountAdministered + amountWasted - existing.amountDrawn) >
    QUANTITY_TOLERANCE
  ) {
    const returned =
      alreadyRestored > QUANTITY_TOLERANCE
        ? ` ${formatQuantity(alreadyRestored)} of it has been returned to stock and is credited back by the release's own entry, so it still counts here.`
        : "";
    throw new ControlledSubstanceLogError(
      `Amount administered plus amount wasted must account for the full amount drawn.${returned}`,
      400,
    );
  }

  // The other side of the same netting: the reversal rows have already taken
  // `alreadyRestored` out of administered, so a row claiming less than that
  // leaves the register showing more given back than was ever given. Read the
  // other way round, it is what stops an amendment recording waste against drug
  // that went back to the cabinet rather than into the patient.
  if (amountAdministered < alreadyRestored - QUANTITY_TOLERANCE) {
    throw new ControlledSubstanceLogError(
      `Amount administered cannot be below the ${formatQuantity(alreadyRestored)} a release has already returned to stock.`,
      400,
    );
  }
};

// Waste on a controlled substance is witnessed. Nothing in the backend asserts
// that today, and this is not the place to start asserting it everywhere - but
// this path is the one that turns a machine row claiming no waste into one that
// records waste, so the witness is required where the waste is created.
const assertWasteIsWitnessed = (tuple: ReturnType<typeof amendedTuple>) => {
  if (tuple.amountWasted > QUANTITY_TOLERANCE && !tuple.wastedWitness) {
    throw new ControlledSubstanceLogError(
      "Recording waste on a controlled substance entry requires a waste witness.",
      400,
    );
  }
};

const assertAmendmentReconciles = (
  existing: CsLogRecord,
  tuple: ReturnType<typeof amendedTuple>,
  alreadyRestored: number,
) => {
  // Re-run against the draw the cabinet actually gave out rather than anything
  // the caller supplied - which is what makes freezing `amountDrawn` load-
  // bearing - and re-run at all because `buildReversalData` negates a row
  // without re-validating it, on the stated premise that the row it negates
  // already passed this. Amending in place is what would otherwise void that
  // premise and let a later release negate quantities nobody checked.
  assertQuantitiesReconcile({
    amountDrawn: existing.amountDrawn,
    amountAdministered: tuple.amountAdministered,
    amountWasted: tuple.amountWasted,
    balanceBefore: existing.balanceBefore,
    balanceAfter: existing.balanceAfter,
  });
  assertDrawIsAccountedFor(existing, tuple, alreadyRestored);
  assertWasteIsWitnessed(tuple);
};

// Successive amendments read as a trail rather than overwriting each other, and
// the entry's own note survives at the end.
const buildAmendmentNote = (
  existing: CsLogRecord,
  params: UpdateCsLogParams,
) => {
  const carried = [
    describeReplaced(existing, params),
    params.notes,
    existing.notes,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ");
  return buildLedgerNote(
    amendmentMarker(existing.id),
    params.correctionReason,
    carried || null,
  );
};

// Amends the clinical facts on an entry the dispense path wrote. The stock side
// is untouched: `amountDrawn`, both balances and the linkage keep the values the
// movement gave them, so a later release still nets against the real draw.
const amendStockLinkedEntry = async (
  existing: CsLogRecord,
  params: UpdateCsLogParams,
) => {
  assertOnlyAmendable(params);
  const tuple = amendedTuple(existing, params);
  assertAmendmentReconciles(
    existing,
    tuple,
    await sumRestoredByReleases(prisma, existing),
  );

  const amended = await prisma.controlledSubstanceLog.update({
    where: { id: existing.id },
    data: {
      patientId: params.patientId ?? existing.patientId,
      ...tuple,
      administeredBy: params.administeredBy ?? existing.administeredBy,
      notes: buildAmendmentNote(existing, params),
    },
    select: csLogSelect,
  });

  await AuditTrailService.recordSafely({
    organisationId: existing.organisationId,
    patientId: amended.patientId ?? "",
    eventType: "CONTROLLED_SUBSTANCE_LOGGED",
    actorType: "PMS_USER",
    actorId:
      params.correctedBy ??
      params.administeredBy ??
      existing.administeredBy ??
      null,
    entityType: "COMPANION",
    entityId: amended.id,
    // No `reason`: it is free text from the request and can carry patient detail,
    // and it is already on the entry itself behind the amendment marker. The
    // audit event does not need a second independent copy of it.
    metadata: {
      action: "AMENDMENT",
      amendedEntryId: existing.id,
      sourceEventId: existing.sourceEventId,
      drug: existing.drug,
      deaSchedule: existing.deaSchedule,
      amountAdministered: tuple.amountAdministered,
      amountWasted: tuple.amountWasted,
      unit: existing.unit,
    },
  });

  return amended;
};

export const ControlledSubstanceLogService = {
  // `client` lets a caller that is already inside prisma.$transaction have its
  // register entry committed or rolled back with the stock movement that caused
  // it. Called with one argument it behaves exactly as before.
  async create(params: CreateCsLogParams, client: CsLogClient = prisma) {
    const { organisationId, administeredBy, ...rest } = params;

    assertQuantitiesReconcile({
      amountDrawn: rest.amountDrawn,
      amountAdministered: rest.amountAdministered,
      amountWasted: rest.amountWasted ?? 0,
      balanceBefore: rest.balanceBefore ?? null,
      balanceAfter: rest.balanceAfter ?? null,
    });

    const record = await client.controlledSubstanceLog.create({
      data: {
        organisationId,
        patientId: rest.patientId ?? null,
        encounterId: rest.encounterId ?? null,
        loggedAt: rest.loggedAt,
        drug: rest.drug,
        deaSchedule: rest.deaSchedule,
        lotNumber: rest.lotNumber ?? null,
        strength: rest.strength ?? null,
        unit: rest.unit,
        amountDrawn: rest.amountDrawn,
        amountAdministered: rest.amountAdministered,
        amountWasted: rest.amountWasted ?? 0,
        wastedWitness: rest.wastedWitness ?? null,
        balanceBefore: rest.balanceBefore ?? null,
        balanceAfter: rest.balanceAfter ?? null,
        administeredBy: administeredBy ?? null,
        notes: rest.notes ?? null,
        sourceEventId: rest.sourceEventId ?? null,
        inventoryBatchId: rest.inventoryBatchId ?? null,
      },
      select: csLogSelect,
    });

    // The audit trail writes on the module-global client, so an entry appended
    // inside a caller's transaction would leave a CONTROLLED_SUBSTANCE_LOGGED
    // event behind if that transaction later rolled back - an audit record for
    // a dispense that never happened. The transactional callers write their own
    // stock-movement and consumption-event rows in the same transaction, so the
    // movement stays fully traceable without this one.
    if (client === prisma) {
      await AuditTrailService.recordSafely({
        organisationId,
        patientId: rest.patientId ?? "",
        eventType: "CONTROLLED_SUBSTANCE_LOGGED",
        actorType: "PMS_USER",
        actorId: administeredBy ?? null,
        entityType: "COMPANION",
        entityId: record.id,
        metadata: {
          drug: rest.drug,
          deaSchedule: rest.deaSchedule,
          amountAdministered: rest.amountAdministered,
          unit: rest.unit,
        },
      });
    }

    return record;
  },

  // Reverses the register entry a dispense wrote, found by the stock movement
  // that wrote it. Returns null instead of throwing when there is nothing to
  // reverse - an entry that predates this code, or a release of stock that was
  // never controlled - because a void must not abort the stock transaction it
  // is part of over a missing ledger row.
  //
  // `amount` is what the release actually restored, which is not always the
  // whole entry: a release can cover part of a batch. Reversing the entry in
  // full there would credit back stock the ledger never says left, so the
  // reversal records the restored amount and no more.
  //
  // Successive partial releases chain. Each row opens where the previous
  // reversal closed and is capped at what is left of the original draw, so the
  // balance column reads straight down the register and the sum of the
  // reversals can never exceed the dispense they cancel.
  async reverseDispenseEntry(
    client: CsLogClient,
    params: {
      organisationId: string;
      sourceEventId: string;
      inventoryBatchId: string;
      reversalEventId: string;
      amount: number;
      reason?: string;
    },
  ) {
    const existing = await client.controlledSubstanceLog.findFirst({
      where: {
        organisationId: params.organisationId,
        sourceEventId: params.sourceEventId,
        inventoryBatchId: params.inventoryBatchId,
      },
      select: csLogSelect,
    });
    if (!existing) return null;

    // Without the reversals this entry already carries, the entry is the only
    // thing each release can see, so a second partial release derives its row
    // from the original dispense again: a 6-unit draw of 10 -> 4 released as 2
    // then 1 records 4 -> 6 and then 4 -> 5 instead of 4 -> 6 and 6 -> 7, and
    // the individual cap lets repeated releases credit back more than was ever
    // drawn.
    const alreadyRestored = await sumRestoredByReleases(client, existing);

    // The cap is what is LEFT of the original draw, not the draw itself.
    const remaining = existing.amountDrawn - alreadyRestored;
    const restored = Math.min(Math.abs(params.amount), remaining);
    // Tolerance rather than `> 0`: once the draw is fully reversed, float
    // subtraction leaves a residue either side of zero, and a +4e-16 residue
    // would otherwise write a ledger row that restores nothing.
    if (restored <= QUANTITY_TOLERANCE) return null;

    // Derived arithmetically rather than read off the newest reversal row, so
    // it needs no ordering and cannot be decided by a createdAt tie: reversal k
    // opens at the dispense's closing balance plus everything reversed before
    // it, which is exactly reversal k-1's own closing balance.
    const balanceBefore =
      existing.balanceAfter === null
        ? null
        : existing.balanceAfter + alreadyRestored;

    return client.controlledSubstanceLog.create({
      data: {
        organisationId: existing.organisationId,
        patientId: existing.patientId,
        encounterId: existing.encounterId,
        loggedAt: existing.loggedAt,
        drug: existing.drug,
        deaSchedule: existing.deaSchedule,
        lotNumber: existing.lotNumber,
        strength: existing.strength,
        unit: existing.unit,
        amountDrawn: -restored,
        amountAdministered: -restored,
        amountWasted: 0,
        wastedWitness: existing.wastedWitness,
        balanceBefore,
        balanceAfter: balanceBefore === null ? null : balanceBefore + restored,
        administeredBy: existing.administeredBy,
        notes: buildLedgerNote(reversalMarker(existing.id), params.reason),
        // Keyed to the release that caused it, never to the dispense it
        // cancels: the pair is unique, and two partial releases of one
        // dispense are two separate, truthful ledger rows.
        sourceEventId: params.reversalEventId,
        inventoryBatchId: params.inventoryBatchId,
      },
      select: csLogSelect,
    });
  },

  async get(id: string, organisationId: string) {
    return assertRecord(id, organisationId);
  },

  async list(params: ListCsLogParams) {
    const { organisationId, patientId, drug, deaSchedule, fromDate, toDate } =
      params;
    return prisma.controlledSubstanceLog.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(drug ? { drug: { contains: drug, mode: "insensitive" } } : {}),
        ...(deaSchedule ? { deaSchedule } : {}),
        ...(fromDate || toDate
          ? {
              loggedAt: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      },
      select: csLogSelect,
      // Reversals and corrections carry the logged-at of the entry they amend,
      // so fall back to insertion order to keep the chain readable.
      orderBy: [{ loggedAt: "desc" }, { createdAt: "desc" }],
    });
  },

  // Corrects an entry by appending a reversal plus a replacement entry. The
  // corrected entry is returned; the entry identified by `id` is left intact.
  async update(id: string, organisationId: string, params: UpdateCsLogParams) {
    const existing = await assertRecord(id, organisationId);
    // A row the dispense wrote cannot be corrected by void-and-replace: its
    // reversal would say the whole draw came back while the stock is still out,
    // and the running balance would read the draw twice. The facts the dispense
    // could not know are amended on the row instead; the rest stays frozen.
    if (existing.sourceEventId) return amendStockLinkedEntry(existing, params);

    const amountDrawn = params.amountDrawn ?? existing.amountDrawn;
    const amountAdministered =
      params.amountAdministered ?? existing.amountAdministered;
    const amountWasted = params.amountWasted ?? existing.amountWasted;
    const balanceBefore = params.balanceBefore ?? existing.balanceBefore;
    const balanceAfter = params.balanceAfter ?? existing.balanceAfter;

    assertQuantitiesReconcile({
      amountDrawn,
      amountAdministered,
      amountWasted,
      balanceBefore,
      balanceAfter,
    });

    const { reversal, correction } = await prisma.$transaction(async (tx) => {
      await assertNotReversed(tx, existing);

      const reversalEntry = await tx.controlledSubstanceLog.create({
        data: buildReversalData(
          existing,
          buildLedgerNote(reversalMarker(existing.id), params.correctionReason),
        ),
        select: csLogSelect,
      });

      const correctionEntry = await tx.controlledSubstanceLog.create({
        data: {
          organisationId: existing.organisationId,
          patientId: params.patientId ?? existing.patientId,
          encounterId: existing.encounterId,
          loggedAt: existing.loggedAt,
          drug: existing.drug,
          deaSchedule: existing.deaSchedule,
          lotNumber: params.lotNumber ?? existing.lotNumber,
          strength: params.strength ?? existing.strength,
          unit: existing.unit,
          amountDrawn,
          amountAdministered,
          amountWasted,
          wastedWitness: params.wastedWitness ?? existing.wastedWitness,
          balanceBefore,
          balanceAfter,
          administeredBy: params.administeredBy ?? existing.administeredBy,
          notes: buildLedgerNote(
            correctionMarker(existing.id),
            params.correctionReason,
            params.notes ?? existing.notes,
          ),
        },
        select: csLogSelect,
      });

      return { reversal: reversalEntry, correction: correctionEntry };
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: existing.patientId ?? "",
      eventType: "CONTROLLED_SUBSTANCE_LOGGED",
      actorType: "PMS_USER",
      actorId:
        params.correctedBy ??
        params.administeredBy ??
        existing.administeredBy ??
        null,
      entityType: "COMPANION",
      entityId: correction.id,
      metadata: {
        action: "CORRECTION",
        correctedEntryId: existing.id,
        reversalEntryId: reversal.id,
        drug: existing.drug,
        deaSchedule: existing.deaSchedule,
        amountAdministered,
        unit: existing.unit,
        ...(params.correctionReason ? { reason: params.correctionReason } : {}),
      },
    });

    return correction;
  },

  // Voids an entry by appending its reversal. Nothing is removed from the
  // ledger; the returned entry is the reversal that cancels the original out.
  async delete(
    id: string,
    organisationId: string,
    params: VoidCsLogParams = {},
  ) {
    const existing = await assertRecord(id, organisationId);
    // Ahead of `assertNotReversed`, whose advice - correct the replacement entry
    // - has no meaning for a partially released dispense: there is no
    // replacement, and correcting is refused here too.
    assertNotStockLinked(existing);

    const reversal = await prisma.$transaction(async (tx) => {
      await assertNotReversed(tx, existing);
      return tx.controlledSubstanceLog.create({
        data: buildReversalData(
          existing,
          buildLedgerNote(reversalMarker(existing.id), params.reason),
        ),
        select: csLogSelect,
      });
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: existing.patientId ?? "",
      eventType: "CONTROLLED_SUBSTANCE_LOGGED",
      actorType: "PMS_USER",
      actorId: params.voidedBy ?? existing.administeredBy ?? null,
      entityType: "COMPANION",
      entityId: reversal.id,
      metadata: {
        action: "VOID",
        voidedEntryId: existing.id,
        drug: existing.drug,
        deaSchedule: existing.deaSchedule,
        amountAdministered: existing.amountAdministered,
        unit: existing.unit,
        ...(params.reason ? { reason: params.reason } : {}),
      },
    });

    return reversal;
  },
};
