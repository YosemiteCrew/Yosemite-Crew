import {
  Prisma,
  PrescriptionFillAuthorizationStatus,
  PrescriptionFillReservationStatus,
} from "@prisma/client";
import { prisma } from "src/config/prisma";

export class PrescriptionFillAuthorisationServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "PrescriptionFillAuthorisationServiceError";
  }
}

/**
 * Who is asking, and whether their role reaches beyond their own prescriptions.
 *
 * `canEditAny` is derived from the caller's loaded permissions by the
 * controller, never from the request body - the same shape `PrescriptionActor`
 * uses for the sibling prescription writes.
 */
export type FillAuthorisationActor = {
  actorId: string;
  canEditAny: boolean;
};

/**
 * Why a fill is not permitted. These are codes rather than sentences because
 * the dispensary and the pet-parent app word the same refusal differently, and
 * only one of them may see a clinical reason at all.
 */
export type FillIneligibilityReason =
  | "NOT_AUTHORISED"
  | "AUTHORITY_REVOKED"
  | "AUTHORITY_SUPERSEDED"
  | "AUTHORITY_EXPIRED"
  | "FILLS_EXHAUSTED";

export type FillEligibility = {
  authorizationId: string | null;
  version: number | null;
  eligible: boolean;
  reasonCodes: FillIneligibilityReason[];
  /**
   * Further fills that may still be allocated, counting the initial fill when
   * it has not been taken yet. A clinician authorising 2 additional refills
   * permits 3 fills in total, so this reads 3 before anything is dispensed.
   */
  remainingFills: number;
  /** `remainingFills` x the authorised per-fill quantity, as a decimal string. */
  remainingQuantity: string | null;
  unit: string | null;
  expiresAt: Date | null;
};

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const requireField = (value: string | undefined, field: string): string => {
  if (!value) {
    throw new PrescriptionFillAuthorisationServiceError(
      `${field} is required`,
      400,
    );
  }
  return value;
};

/**
 * Serialises every read-then-write on one item's authorisation.
 *
 * The unique index on (authorizationId, fillOrdinal) is what makes a lost lock
 * a constraint violation rather than an over-allocation, but it cannot by
 * itself stop two sessions each counting 1 fill remaining and each allocating
 * a DIFFERENT ordinal. Counting under this lock is what does that.
 */
const lockItem = async (
  tx: Prisma.TransactionClient,
  organisationId: string,
  itemId: string,
) => {
  const lockKey = `prescription-fill-authorization:${organisationId}:${itemId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
};

/**
 * Refuses a caller who only holds `prescription:edit:own` on someone else's
 * prescription.
 *
 * The router accepts `prescription:edit:own` on the two write routes, so the
 * organisation check in `loadOwnedItem` is not the whole of authorisation:
 * without this, an own-only role could issue and revoke fill authority over
 * every prescription in its organisation. Same rule and same message as
 * `assertActorMayMutateArtifact` in clinical-artifact.service, which guards
 * the sibling prescription writes.
 */
const assertActorMayAuthorise = (
  artifact: { authorId: string | null },
  actor: FillAuthorisationActor,
) => {
  if (actor.canEditAny) return;

  if (!actor.actorId || artifact.authorId !== actor.actorId) {
    throw new PrescriptionFillAuthorisationServiceError(
      "Prescription was authored by another user",
      403,
    );
  }
};

/**
 * The item, only if this organisation owns it.
 *
 * Ownership lives on the artifact rather than the item, so an itemId from
 * another organisation resolves to nothing here instead of being trusted from
 * the request.
 */
const loadOwnedItem = async (
  tx: Prisma.TransactionClient,
  organisationId: string,
  itemId: string,
) => {
  const item = await tx.prescriptionItem.findFirst({
    where: {
      id: itemId,
      prescription: { artifact: { organisationId } },
    },
    select: {
      id: true,
      prescriptionId: true,
      prescription: {
        select: { artifact: { select: { encounterId: true, authorId: true } } },
      },
    },
  });

  if (!item) {
    throw new PrescriptionFillAuthorisationServiceError(
      "Prescription item not found",
      404,
    );
  }

  return item;
};

/**
 * The patient this prescription was written for, or null when the artifact is
 * not attached to an encounter.
 *
 * Resolved here rather than accepted from the caller: a request-supplied
 * patientId would let one organisation's fill be recorded against another's
 * animal. It comes from the encounter and not the appointment because
 * `Appointment.patient` is a JSON snapshot taken at booking, while
 * `Encounter.patientId` is the identifier the rest of the clinical record uses.
 */
const resolvePatientId = async (
  tx: Prisma.TransactionClient,
  organisationId: string,
  encounterId: string | null | undefined,
): Promise<string | null> => {
  if (!encounterId) return null;

  const encounter = await tx.encounter.findFirst({
    where: { id: encounterId, organisationId },
    select: { patientId: true },
  });

  return encounter?.patientId ?? null;
};

const loadActiveAuthorization = (
  tx: Prisma.TransactionClient,
  organisationId: string,
  itemId: string,
) =>
  tx.prescriptionFillAuthorization.findFirst({
    where: {
      organisationId,
      itemId,
      status: PrescriptionFillAuthorizationStatus.ACTIVE,
    },
    orderBy: { version: "desc" },
  });

const countAllocatedFills = (
  tx: Prisma.TransactionClient,
  authorizationId: string,
) =>
  tx.prescriptionFillReservation.count({
    where: {
      authorizationId,
      status: { not: PrescriptionFillReservationStatus.CANCELLED },
    },
  });

const NOT_AUTHORISED: FillEligibility = {
  authorizationId: null,
  version: null,
  eligible: false,
  reasonCodes: ["NOT_AUTHORISED"],
  remainingFills: 0,
  remainingQuantity: null,
  unit: null,
  expiresAt: null,
};

type AuthorityRow = {
  id: string;
  version: number;
  validUntil: Date;
  maxAdditionalFills: number;
  perFillQuantity: Prisma.Decimal;
  perFillQuantityUnit: string;
};

/**
 * `at >= validUntil` is expired, not `>`. An authority valid until midnight
 * does not authorise a fill completed at midnight.
 */
const hasExpired = (authority: AuthorityRow, at: Date) =>
  at.getTime() >= authority.validUntil.getTime();

const describeEligibility = (
  authority: AuthorityRow,
  allocated: number,
  at: Date,
): FillEligibility => {
  // maxAdditionalFills counts REPEATS, so the initial fill is the +1.
  const remainingFills = Math.max(
    0,
    authority.maxAdditionalFills + 1 - allocated,
  );
  const reasonCodes: FillIneligibilityReason[] = [];

  if (hasExpired(authority, at)) reasonCodes.push("AUTHORITY_EXPIRED");
  if (remainingFills === 0) reasonCodes.push("FILLS_EXHAUSTED");

  return {
    authorizationId: authority.id,
    version: authority.version,
    eligible: reasonCodes.length === 0,
    reasonCodes,
    remainingFills,
    remainingQuantity: authority.perFillQuantity.mul(remainingFills).toString(),
    unit: authority.perFillQuantityUnit,
    expiresAt: authority.validUntil,
  };
};

export const PrescriptionFillAuthorisationService = {
  /**
   * Issue a clinician's repeat authority for one prescription item.
   *
   * An authority is immutable, so a correction is a new row that supersedes the
   * previous one and carries the next version. That is what lets a caller
   * holding version 1 be refused at reservation rather than quietly handed
   * version 2's allowance.
   */
  async authoriseFills(params: {
    organisationId: string;
    itemId: string;
    validUntil: Date;
    maxAdditionalFills: number;
    perFillQuantity: Prisma.Decimal.Value;
    perFillQuantityUnit: string;
    authorisedBy: string;
    canEditAny: boolean;
    now?: Date;
  }) {
    const organisationId = requireField(
      asNonEmptyString(params.organisationId),
      "organisationId",
    );
    const itemId = requireField(asNonEmptyString(params.itemId), "itemId");
    const unit = requireField(
      asNonEmptyString(params.perFillQuantityUnit),
      "perFillQuantityUnit",
    );
    const authorisedBy = requireField(
      asNonEmptyString(params.authorisedBy),
      "authorisedBy",
    );
    const now = params.now ?? new Date();

    if (
      !Number.isInteger(params.maxAdditionalFills) ||
      params.maxAdditionalFills < 0
    ) {
      throw new PrescriptionFillAuthorisationServiceError(
        "maxAdditionalFills must be a non-negative integer",
        400,
      );
    }

    const perFillQuantity = new Prisma.Decimal(params.perFillQuantity);
    if (perFillQuantity.lessThanOrEqualTo(0)) {
      throw new PrescriptionFillAuthorisationServiceError(
        "perFillQuantity must be greater than zero",
        400,
      );
    }

    if (params.validUntil.getTime() <= now.getTime()) {
      throw new PrescriptionFillAuthorisationServiceError(
        "validUntil must be in the future",
        400,
      );
    }

    return prisma.$transaction(async (tx) => {
      await lockItem(tx, organisationId, itemId);
      const item = await loadOwnedItem(tx, organisationId, itemId);
      assertActorMayAuthorise(item.prescription.artifact, {
        actorId: authorisedBy,
        canEditAny: params.canEditAny,
      });
      const patientId = await resolvePatientId(
        tx,
        organisationId,
        item.prescription.artifact.encounterId,
      );

      const previous = await loadActiveAuthorization(
        tx,
        organisationId,
        itemId,
      );

      if (previous) {
        await tx.prescriptionFillAuthorization.update({
          where: { id: previous.id },
          data: { status: PrescriptionFillAuthorizationStatus.SUPERSEDED },
        });
      }

      return tx.prescriptionFillAuthorization.create({
        data: {
          organisationId,
          patientId,
          prescriptionId: item.prescriptionId,
          itemId,
          version: (previous?.version ?? 0) + 1,
          validUntil: params.validUntil,
          maxAdditionalFills: params.maxAdditionalFills,
          perFillQuantity,
          perFillQuantityUnit: unit,
          authorisedBy,
          authorisedAt: now,
          supersedesId: previous?.id,
        },
      });
    });
  },

  /**
   * Withdraw an authority. Reservations already allocated against it are left
   * alone: a fill that has been handed over is a fact, and cancelling it is the
   * dispensary's decision rather than a side effect of this one.
   */
  async revokeAuthorization(params: {
    organisationId: string;
    authorizationId: string;
    revokedBy: string;
    canEditAny: boolean;
    reason?: string;
    now?: Date;
  }) {
    const organisationId = requireField(
      asNonEmptyString(params.organisationId),
      "organisationId",
    );
    const authorizationId = requireField(
      asNonEmptyString(params.authorizationId),
      "authorizationId",
    );
    const revokedBy = requireField(
      asNonEmptyString(params.revokedBy),
      "revokedBy",
    );
    const now = params.now ?? new Date();

    const authority = await prisma.prescriptionFillAuthorization.findFirst({
      where: { id: authorizationId, organisationId },
    });

    if (!authority) {
      throw new PrescriptionFillAuthorisationServiceError(
        "Fill authorisation not found",
        404,
      );
    }

    if (authority.status !== PrescriptionFillAuthorizationStatus.ACTIVE) {
      throw new PrescriptionFillAuthorisationServiceError(
        "Only an active fill authorisation can be revoked",
        409,
      );
    }

    // Only an own-only caller needs the item read, and it goes through the
    // same organisation-scoped join `authoriseFills` uses rather than trusting
    // the authority row's own denormalised ids.
    if (!params.canEditAny) {
      const item = await loadOwnedItem(
        prisma,
        organisationId,
        authority.itemId,
      );
      assertActorMayAuthorise(item.prescription.artifact, {
        actorId: revokedBy,
        canEditAny: false,
      });
    }

    return prisma.prescriptionFillAuthorization.update({
      where: { id: authority.id },
      data: {
        status: PrescriptionFillAuthorizationStatus.REVOKED,
        revokedBy,
        revokedAt: now,
        revokedReason: asNonEmptyString(params.reason),
      },
    });
  },

  /**
   * Advisory only. It answers what is true at `now` for a reader deciding what
   * to show; the authoritative refusal happens inside `reserveFill`, under the
   * lock, because anything read outside one can be spent before it is acted on.
   */
  async getFillEligibility(params: {
    organisationId: string;
    itemId: string;
    now?: Date;
  }): Promise<FillEligibility> {
    const organisationId = requireField(
      asNonEmptyString(params.organisationId),
      "organisationId",
    );
    const itemId = requireField(asNonEmptyString(params.itemId), "itemId");
    const now = params.now ?? new Date();

    const authority = await loadActiveAuthorization(
      prisma,
      organisationId,
      itemId,
    );

    if (!authority) {
      const superseded = await prisma.prescriptionFillAuthorization.findFirst({
        where: { organisationId, itemId },
        orderBy: { version: "desc" },
        select: { status: true },
      });

      if (superseded?.status === PrescriptionFillAuthorizationStatus.REVOKED) {
        return { ...NOT_AUTHORISED, reasonCodes: ["AUTHORITY_REVOKED"] };
      }
      if (
        superseded?.status === PrescriptionFillAuthorizationStatus.SUPERSEDED
      ) {
        return { ...NOT_AUTHORISED, reasonCodes: ["AUTHORITY_SUPERSEDED"] };
      }
      return NOT_AUTHORISED;
    }

    const allocated = await countAllocatedFills(prisma, authority.id);
    return describeEligibility(authority, allocated, now);
  },

  /**
   * Allocate one fill against the active authority.
   *
   * `idempotencyKey` replays: the same intent arriving twice returns the first
   * reservation rather than spending a second repeat, which is what a worker
   * retrying after a timeout needs. A DIFFERENT intent reusing a key is a
   * conflict and is refused.
   */
  async reserveFill(params: {
    organisationId: string;
    itemId: string;
    idempotencyKey: string;
    expectedVersion?: number;
    reservedBy?: string;
    dispenseRequestId?: string;
    now?: Date;
  }) {
    const organisationId = requireField(
      asNonEmptyString(params.organisationId),
      "organisationId",
    );
    const itemId = requireField(asNonEmptyString(params.itemId), "itemId");
    const idempotencyKey = requireField(
      asNonEmptyString(params.idempotencyKey),
      "idempotencyKey",
    );
    const now = params.now ?? new Date();

    return prisma.$transaction(async (tx) => {
      await lockItem(tx, organisationId, itemId);

      const replay = await tx.prescriptionFillReservation.findUnique({
        where: {
          organisationId_idempotencyKey: { organisationId, idempotencyKey },
        },
      });

      if (replay) {
        if (replay.itemId !== itemId) {
          throw new PrescriptionFillAuthorisationServiceError(
            "idempotencyKey has already been used for a different prescription item",
            409,
          );
        }
        return replay;
      }

      const authority = await loadActiveAuthorization(
        tx,
        organisationId,
        itemId,
      );

      if (!authority) {
        throw new PrescriptionFillAuthorisationServiceError(
          "No active fill authorisation for this prescription item",
          409,
        );
      }

      if (
        params.expectedVersion !== undefined &&
        params.expectedVersion !== authority.version
      ) {
        throw new PrescriptionFillAuthorisationServiceError(
          `Fill authorisation has moved to version ${authority.version}`,
          409,
        );
      }

      const allocated = await countAllocatedFills(tx, authority.id);
      const eligibility = describeEligibility(authority, allocated, now);

      if (!eligibility.eligible) {
        throw new PrescriptionFillAuthorisationServiceError(
          `Fill not permitted: ${eligibility.reasonCodes.join(", ")}`,
          409,
        );
      }

      // The allocation sequence, not the repeat number: a cancelled ordinal is
      // never reused, so this only ever moves forward.
      const highest = await tx.prescriptionFillReservation.findFirst({
        where: { authorizationId: authority.id },
        orderBy: { fillOrdinal: "desc" },
        select: { fillOrdinal: true },
      });

      return tx.prescriptionFillReservation.create({
        data: {
          organisationId,
          authorizationId: authority.id,
          itemId,
          dispenseRequestId: asNonEmptyString(params.dispenseRequestId),
          fillOrdinal: (highest?.fillOrdinal ?? -1) + 1,
          quantity: authority.perFillQuantity,
          quantityUnit: authority.perFillQuantityUnit,
          idempotencyKey,
          reservedBy: asNonEmptyString(params.reservedBy),
          reservedAt: now,
        },
      });
    });
  },

  /**
   * Record what was physically handed over against a reservation.
   *
   * A short fill accumulates on the same ordinal rather than completing it, so
   * 3 of an authorised 10 leaves 7 owing on that fill and does NOT consume a
   * second repeat. Expiry is checked again here because a reservation made
   * inside the window can be fulfilled outside it.
   */
  async recordFulfilment(params: {
    organisationId: string;
    reservationId: string;
    quantity: Prisma.Decimal.Value;
    now?: Date;
  }) {
    const organisationId = requireField(
      asNonEmptyString(params.organisationId),
      "organisationId",
    );
    const reservationId = requireField(
      asNonEmptyString(params.reservationId),
      "reservationId",
    );
    const now = params.now ?? new Date();
    const quantity = new Prisma.Decimal(params.quantity);

    if (quantity.lessThanOrEqualTo(0)) {
      throw new PrescriptionFillAuthorisationServiceError(
        "quantity must be greater than zero",
        400,
      );
    }

    return prisma.$transaction(async (tx) => {
      const reservation = await tx.prescriptionFillReservation.findFirst({
        where: { id: reservationId, organisationId },
        include: { authorization: true },
      });

      if (!reservation) {
        throw new PrescriptionFillAuthorisationServiceError(
          "Fill reservation not found",
          404,
        );
      }

      if (reservation.status !== PrescriptionFillReservationStatus.RESERVED) {
        throw new PrescriptionFillAuthorisationServiceError(
          `A ${reservation.status.toLowerCase()} fill cannot be fulfilled`,
          409,
        );
      }

      if (hasExpired(reservation.authorization, now)) {
        throw new PrescriptionFillAuthorisationServiceError(
          "Fill authorisation expired before this fill was completed",
          409,
        );
      }

      const fulfilled = reservation.fulfilledQuantity.add(quantity);
      if (fulfilled.greaterThan(reservation.quantity)) {
        throw new PrescriptionFillAuthorisationServiceError(
          "Fulfilled quantity would exceed the authorised quantity for this fill",
          409,
        );
      }

      const complete = fulfilled.greaterThanOrEqualTo(reservation.quantity);

      return tx.prescriptionFillReservation.update({
        where: { id: reservation.id },
        data: {
          fulfilledQuantity: fulfilled,
          ...(complete
            ? {
                status: PrescriptionFillReservationStatus.COMPLETED,
                completedAt: now,
              }
            : {}),
        },
      });
    });
  },

  /**
   * Release an undispensed fill back to the authority. A completed fill is not
   * cancellable here - reversing a physical dispense is a stock decision and
   * must not silently mint a repeat.
   */
  async cancelReservation(params: {
    organisationId: string;
    reservationId: string;
    reason?: string;
    now?: Date;
  }) {
    const organisationId = requireField(
      asNonEmptyString(params.organisationId),
      "organisationId",
    );
    const reservationId = requireField(
      asNonEmptyString(params.reservationId),
      "reservationId",
    );
    const now = params.now ?? new Date();

    const reservation = await prisma.prescriptionFillReservation.findFirst({
      where: { id: reservationId, organisationId },
    });

    if (!reservation) {
      throw new PrescriptionFillAuthorisationServiceError(
        "Fill reservation not found",
        404,
      );
    }

    if (reservation.status === PrescriptionFillReservationStatus.CANCELLED) {
      return reservation;
    }

    if (reservation.status === PrescriptionFillReservationStatus.COMPLETED) {
      throw new PrescriptionFillAuthorisationServiceError(
        "A completed fill cannot be cancelled; reverse the dispense instead",
        409,
      );
    }

    return prisma.prescriptionFillReservation.update({
      where: { id: reservation.id },
      data: {
        status: PrescriptionFillReservationStatus.CANCELLED,
        cancelledAt: now,
        cancelledReason: asNonEmptyString(params.reason),
      },
    });
  },
};
