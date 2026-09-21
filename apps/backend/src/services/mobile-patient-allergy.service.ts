import type {
  AllergySeverity,
  AllergyStatus,
  AllergyType,
} from "@prisma/client";
import { prisma } from "src/config/prisma";

/**
 * The owner's view of what their companion is allergic to (#2706).
 *
 * `PatientAllergy` has existed, with a mounted router and a PIMS surface, while
 * `apps/mobileAppYC/src` carried zero references to it. The practice recorded
 * that an animal reacts to something and the owner - the person actually
 * administering the medication, handing the animal to a boarding kennel, or
 * describing it to an out-of-hours service that is not this practice - had no
 * way to see it. This is the read that closes that.
 *
 * Kept out of `patient-allergy.service` on purpose, for the same reason
 * `mobile-care-reminder.service` is kept out of `care-reminder.service`: every
 * read there takes an `organisationId` the caller has been proven a member of
 * and is authorised on staff RBAC. The mobile caller has neither an
 * organisation nor a staff role, so the scoping rules differ, and the scoping
 * rules are the whole point of the module.
 */

/**
 * What the owner is shown.
 *
 * RESOLVED is excluded. It carries a `resolvedDate` and means the practice
 * concluded the animal is no longer allergic, so listing it beside the live
 * ones turns the screen into a history rather than the answer to "can I give
 * this". UNCONFIRMED is included, and deliberately: a suspected allergy is
 * precisely the case where the owner should hesitate, and `status` goes out on
 * the wire so the client can say "suspected" rather than presenting it as
 * settled.
 *
 * Same shape of decision as `OPEN_REMINDER_STATUSES` in
 * `mobile-care-reminder.service` - the surface picks the states that are still
 * actionable rather than handing over the table.
 */
const OWNER_VISIBLE_ALLERGY_STATUSES: AllergyStatus[] = [
  "ACTIVE",
  "UNCONFIRMED",
];

export type MobilePatientAllergy = {
  id: string;
  patientId: string;
  /** Which practice recorded it. See `listAllergiesForCompanion`. */
  organisationId: string;
  allergen: string;
  allergyType: AllergyType;
  severity: AllergySeverity;
  reaction?: string;
  /** ACTIVE or UNCONFIRMED. The client words the latter as suspected. */
  status: AllergyStatus;
  onsetDate?: string;
  recordedAt: string;
  updatedAt: string;
};

/**
 * Every live allergy on this companion, most severe first.
 *
 * NOT paginated, and not for lack of a helper. This is one animal's allergy
 * list: the set is bounded by what a clinician has actually recorded, the PIMS
 * list it mirrors is unpaged for the same reason, and a page boundary in an
 * allergy list is a way to silently withhold the row that mattered. The care
 * reminder list pages because it spans every companion the parent has and
 * grows with time; this does neither.
 *
 * Ordering is the PIMS list's, severity descending - Prisma orders an enum by
 * its declared order, and `AllergySeverity` is declared MILD to
 * LIFE_THREATENING, so descending puts LIFE_THREATENING at the top. That
 * matters more here than on the desktop: a phone shows three rows without
 * scrolling, and the three it shows should be the three that can kill.
 *
 * There is NO organisation filter, and that is the point rather than an
 * oversight. The row names `patientId` directly, the caller has already been
 * proven an ACTIVE parent link with `medicalRecords` on that exact patient by
 * `requireCompanionPermission`, and an animal seen by a second practice has its
 * allergies recorded under that practice's `organisationId`. Filtering by one
 * org would hide exactly the record the owner cannot get any other way -
 * the PIMS view is org-scoped and therefore structurally cannot show it.
 * `organisationId` goes out on each row instead, so the client can say who
 * recorded it.
 *
 * `notes` and `recordedBy` are not selected. `notes` is the practice's own
 * working text and `recordedBy` is a staff id; neither is the owner's, and the
 * PIMS select is not reused wholesale for that reason.
 */
export const listAllergiesForCompanion = async (
  patientId: string,
): Promise<MobilePatientAllergy[]> => {
  // A falsy id must never reach a `where`: Prisma drops an `undefined` field
  // rather than matching nothing, and `{ patientId: undefined }` would return
  // every allergy in the database. The middleware guards this too; the cost of
  // being wrong is high enough to guard it twice.
  if (!patientId) {
    return [];
  }

  const rows = await prisma.patientAllergy.findMany({
    where: {
      patientId,
      status: { in: OWNER_VISIBLE_ALLERGY_STATUSES },
    },
    select: {
      id: true,
      patientId: true,
      organisationId: true,
      allergen: true,
      allergyType: true,
      severity: true,
      reaction: true,
      status: true,
      onsetDate: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [
      { severity: "desc" },
      { allergyType: "asc" },
      { createdAt: "desc" },
    ],
  });

  return rows.map((row) => ({
    id: row.id,
    patientId: row.patientId,
    organisationId: row.organisationId,
    allergen: row.allergen,
    allergyType: row.allergyType,
    severity: row.severity,
    // `?? undefined` rather than passing the null through: the field is
    // optional on the wire, and JSON.stringify drops an undefined but emits a
    // null, so a client checking presence would see a reaction that is there
    // and empty.
    reaction: row.reaction ?? undefined,
    status: row.status,
    onsetDate: row.onsetDate?.toISOString(),
    // Named for what it is to the reader rather than for the column. The row's
    // `createdAt` is when the practice wrote it down, which is not when the
    // animal became allergic - that is `onsetDate`, and it is nullable because
    // it is usually unknown.
    recordedAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
};

export const MobilePatientAllergyService = {
  listAllergiesForCompanion,
};
