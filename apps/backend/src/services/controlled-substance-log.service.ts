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

type DeaSchedule = "II" | "III" | "IV" | "V";
type DrugUnit = "ML" | "MG" | "MCG" | "TABLET" | "CAPSULE" | "PATCH" | "UNIT";

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
}

export type UpdateCsLogParams = Partial<
  Omit<
    CreateCsLogParams,
    | "organisationId"
    | "patientId"
    | "loggedAt"
    | "drug"
    | "deaSchedule"
    | "unit"
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
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ControlledSubstanceLogSelect;

// Quantities are stored as floats, so reconcile with a small tolerance instead
// of exact equality.
const QUANTITY_TOLERANCE = 1e-6;

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

// The ledger is append-only: an entry is never mutated or deleted. A correction
// appends a reversing entry (every quantity negated) followed by a replacement
// entry, and a void appends the reversing entry alone, so the original row and
// the balances it carries stay readable and reconcilable forever. The trailing
// `]` in the marker keeps `startsWith` from matching a longer id.
const reversalMarker = (sourceId: string) => `[reversal:${sourceId}]`;
const correctionMarker = (sourceId: string) => `[correction:${sourceId}]`;

const buildLedgerNote = (
  marker: string,
  reason?: string | null,
  carriedNotes?: string | null,
) =>
  [marker, reason, carriedNotes]
    .filter((part): part is string => Boolean(part))
    .join(" ");

const assertRecord = async (id: string, organisationId: string) => {
  const record = await prisma.controlledSubstanceLog.findFirst({
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

export const ControlledSubstanceLogService = {
  async create(params: CreateCsLogParams) {
    const { organisationId, administeredBy, ...rest } = params;

    assertQuantitiesReconcile({
      amountDrawn: rest.amountDrawn,
      amountAdministered: rest.amountAdministered,
      amountWasted: rest.amountWasted ?? 0,
      balanceBefore: rest.balanceBefore ?? null,
      balanceAfter: rest.balanceAfter ?? null,
    });

    const record = await prisma.controlledSubstanceLog.create({
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
      },
      select: csLogSelect,
    });

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

    return record;
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
          patientId: existing.patientId,
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
