import { ClinicalArtifactStatus } from "@prisma/client";
import { prisma } from "src/config/prisma";
import { hasCompanionFeature } from "src/middlewares/companion-access";

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
): Promise<MobilePrescription[]> => {
  const patientIds = await listPermittedPatientIds(parentId);
  if (patientIds.length === 0) {
    return [];
  }

  const encounters = await prisma.encounter.findMany({
    where: { patientId: { in: patientIds } },
    select: { id: true, patientId: true },
  });
  if (encounters.length === 0) {
    return [];
  }

  const patientIdByEncounter = new Map(
    encounters.map((encounter) => [encounter.id, encounter.patientId]),
  );

  const prescriptions = await prisma.prescription.findMany({
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
    orderBy: { createdAt: "desc" },
  });

  return prescriptions.flatMap((prescription) => {
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
};

export const MobilePrescriptionService = {
  listPermittedPatientIds,
  listPrescriptionsForParent,
};
