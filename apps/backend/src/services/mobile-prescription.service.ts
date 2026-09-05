import { ClinicalArtifactStatus } from "@prisma/client";
import { prisma } from "src/config/prisma";
import { hasCompanionFeature } from "src/middlewares/companion-access";
import { clampPageSize, splitPage } from "src/services/shared/pagination";

/**
 * Owner-facing prescription reads for the pet owner app.
 *
 * Kept out of ClinicalArtifactService deliberately: that service is scoped by
 * organisation and authorised on staff RBAC, and the mobile caller has neither.
 * The scoping rules here are the whole point of the module, so they live in one
 * place rather than being spread across a controller.
 */

/**
 * A prescription reaches an owner only through a *finalised* artifact. DRAFT and
 * IN_PROGRESS are the clinician still writing; VOID was withdrawn.
 */
const OWNER_VISIBLE_ARTIFACT_STATUSES: ClinicalArtifactStatus[] = [
  ClinicalArtifactStatus.COMPLETED,
  ClinicalArtifactStatus.SIGNED,
];

/**
 * The patients whose medical records this parent may read.
 *
 * Two gates, not one. A REVOKED or PENDING link is not access, and a CO_PARENT
 * link carries a `permissions` object in which `medicalRecords` can be false —
 * that co-parent can see appointments and tasks but must not see what the animal
 * has been prescribed.
 *
 * The decision itself is `hasCompanionFeature`, the same predicate
 * `requireCompanionPermission` enforces on every path-keyed companion route,
 * rather than a second copy of the rule. That middleware cannot be used here —
 * it authorises one patient id from the path, and this resolves the whole set
 * before any patient is named — so sharing the predicate is what keeps the two
 * answers identical. Notably it means a PRIMARY parent passes on their role: a
 * primary link with `medicalRecords: false` is reachable, and it already reads
 * the same animal's passport through the middleware, so refusing here would
 * have returned an empty list with nothing saying why.
 */
export const listPermittedPatientIds = async (
  parentId: string,
): Promise<string[]> => {
  if (!parentId) {
    return [];
  }

  const links = await prisma.parentPatient.findMany({
    where: { parentId, status: "ACTIVE" },
    select: { patientId: true, role: true, permissions: true },
  });

  return links
    .filter((link) =>
      hasCompanionFeature(link.role, link.permissions, "medicalRecords"),
    )
    .map((link) => link.patientId);
};

export type MobilePrescriptionItem = {
  id: string;
  medication: string;
  strength?: string;
  dosage?: string;
  route?: string;
  frequency?: string;
  duration?: string;
  quantity?: string;
  instructions?: string;
  refill?: string;
};

export type MobilePrescription = {
  id: string;
  patientId: string;
  encounterId: string;
  organisationId: string;
  status: ClinicalArtifactStatus;
  summary?: string;
  signedAt?: string;
  createdAt: string;
  items: MobilePrescriptionItem[];
};

/**
 * A phone screen, not a data export. 20 is what fits before a scroll and 100 is
 * the ceiling a caller can ask for; both are this surface's numbers, applied by
 * the shared clamp in `shared/pagination`.
 */
export const DEFAULT_PRESCRIPTION_PAGE_SIZE = 20;
export const MAX_PRESCRIPTION_PAGE_SIZE = 100;

export type MobilePrescriptionPage = {
  prescriptions: MobilePrescription[];
  /** The cursor for the next page, or null when this is the last one. */
  nextCursor: string | null;
  /** Whether another page exists. Never inferred from `prescriptions.length`. */
  hasMore: boolean;
  /** The page size actually applied, which is not always the one requested. */
  limit: number;
};

export type ListPrescriptionsForParentOptions = {
  /** Clamped, never rejected. See `clampPageSize`. */
  limit?: unknown;
  /** A prescription id from a previous `nextCursor`. */
  cursor?: string;
};

/**
 * Prescriptions the parent may read, newest first.
 *
 * Fail-closed on the binding. `ClinicalArtifact` has no companion column, and
 * its `appointmentId`, `caseId` and `encounterId` are all nullable, so the only
 * trustworthy path to the animal is `encounterId -> Encounter.patientId`. An
 * artifact with no encounter has nothing tying it to a patient, and this returns
 * nothing rather than guessing from an organisation or a body-supplied id.
 *
 * The consequence is deliberate and worth stating: a prescription written
 * outside an encounter never reaches the owner's app, and nothing tells them it
 * exists. That is the safe direction of a wrong answer here - the unsafe one
 * would show an owner another client's medication.
 */
export const listPrescriptionsForParent = async (
  parentId: string,
  options: ListPrescriptionsForParentOptions = {},
): Promise<MobilePrescriptionPage> => {
  const limit = clampPageSize(options.limit, {
    defaultSize: DEFAULT_PRESCRIPTION_PAGE_SIZE,
    maxSize: MAX_PRESCRIPTION_PAGE_SIZE,
  });
  const empty: MobilePrescriptionPage = {
    prescriptions: [],
    nextCursor: null,
    hasMore: false,
    limit,
  };

  const patientIds = await listPermittedPatientIds(parentId);
  if (patientIds.length === 0) {
    return empty;
  }

  /*
   * Deliberately unpaged, and it is the one read here that stays that way.
   * Bounding it would be silent loss rather than a page: prescriptions are
   * ordered by their own `createdAt`, so a `take` on the encounters drops
   * whichever prescriptions hang off the encounters that fell off the end, and
   * nothing in the response could say which. It is index-served
   * (`@@index([patientId])`) and scoped to one parent's own animals, so it is
   * bounded by the domain even though it is not bounded by a `take`. #2709
   * lists a date floor as the alternative; that changes what the endpoint
   * returns and is a product decision, not a performance fix.
   */
  const encounters = await prisma.encounter.findMany({
    where: { patientId: { in: patientIds } },
    select: { id: true, patientId: true },
  });
  if (encounters.length === 0) {
    return empty;
  }

  const patientIdByEncounter = new Map(
    encounters.map((encounter) => [encounter.id, encounter.patientId]),
  );

  /*
   * Keyset pagination on `(createdAt, id)`, one row over the page so `hasMore`
   * is measured rather than guessed.
   *
   * The `id` tiebreak is not decoration: prescriptions written in the same
   * consultation share a `createdAt` to the millisecond, and without a total
   * order the cursor position is ambiguous - a page boundary landing inside a
   * tied group repeats a row or drops one.
   *
   * The cursor is a position, never an access grant. `where` is rebuilt from
   * `patientIdByEncounter` on every page, so a cursor lifted from another
   * parent's response moves the window and widens nothing.
   */
  const rows = await prisma.prescription.findMany({
    where: {
      artifact: {
        encounterId: { in: [...patientIdByEncounter.keys()] },
        status: { in: OWNER_VISIBLE_ARTIFACT_STATUSES },
      },
    },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      artifact: {
        select: {
          encounterId: true,
          organisationId: true,
          status: true,
          summary: true,
          signedAt: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });

  /*
   * Split before mapping. The cursor has to be the last row the query returned
   * for this page, not the last row that survived the mapping below - a row
   * dropped as unmappable would otherwise be handed back as the next page's
   * starting point and re-dropped forever.
   */
  const { items, nextCursor, hasMore } = splitPage(rows, limit);

  const prescriptions = items.flatMap((prescription) => {
    const encounterId = prescription.artifact.encounterId;
    // Narrowing only. The query already excluded null encounters; a row that
    // reaches here without one would be a scoping hole, so it is dropped.
    if (!encounterId) {
      return [];
    }
    const patientId = patientIdByEncounter.get(encounterId);
    if (!patientId) {
      return [];
    }

    return [
      {
        id: prescription.id,
        patientId,
        encounterId,
        organisationId: prescription.artifact.organisationId,
        status: prescription.artifact.status,
        summary: prescription.artifact.summary ?? undefined,
        signedAt: prescription.artifact.signedAt?.toISOString(),
        createdAt: prescription.createdAt.toISOString(),
        items: prescription.items.map((item) => ({
          id: item.id,
          medication: item.medication,
          strength: item.strength ?? undefined,
          dosage: item.dosage ?? undefined,
          route: item.route ?? undefined,
          frequency: item.frequency ?? undefined,
          duration: item.duration ?? undefined,
          quantity: item.quantity ?? undefined,
          instructions: item.instructions ?? undefined,
          refill: item.refill ?? undefined,
        })),
      },
    ];
  });

  return { prescriptions, nextCursor, hasMore, limit };
};

export const MobilePrescriptionService = {
  listPermittedPatientIds,
  listPrescriptionsForParent,
};
