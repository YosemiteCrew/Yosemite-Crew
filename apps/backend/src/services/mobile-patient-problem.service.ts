import type { ProblemSeverity, ProblemStatus } from "@prisma/client";
import { prisma } from "src/config/prisma";

/**
 * The owner's view of what their companion is being treated for (#2706).
 *
 * The sibling of `mobile-patient-allergy.service`, and kept out of
 * `patient-problem.service` for the same reason: every read there takes an
 * `organisationId` the caller has been proven a member of and is authorised on
 * staff RBAC. The mobile caller has neither an organisation nor a staff role,
 * so the scoping rules differ, and the scoping rules are the whole point of the
 * module.
 */

/**
 * What the owner is shown.
 *
 * RESOLVED is excluded: it carries a `resolvedDate` and means the practice
 * concluded the condition is over, so listing it beside the live ones turns the
 * screen into a history rather than the answer to "what is wrong with my
 * animal". INACTIVE is included, and deliberately - a dormant chronic condition
 * is still the animal's condition, it is what an out-of-hours service needs to
 * hear, and it is distinct from resolved precisely because nobody has concluded
 * it is over. `status` goes out on the wire so the client can word the two
 * differently.
 *
 * Same shape of decision as `OWNER_VISIBLE_ALLERGY_STATUSES` next door.
 */
const OWNER_VISIBLE_PROBLEM_STATUSES: ProblemStatus[] = ["ACTIVE", "INACTIVE"];

export type MobilePatientProblem = {
  id: string;
  patientId: string;
  /** Which practice recorded it. See `listProblemsForCompanion`. */
  organisationId: string;
  name: string;
  /** The coding scheme, when the practice coded it rather than free-texting. */
  codeSystem?: string;
  code?: string;
  /** ACTIVE or INACTIVE. The client words the latter as dormant, not resolved. */
  status: ProblemStatus;
  severity?: ProblemSeverity;
  onsetDate?: string;
  recordedAt: string;
  updatedAt: string;
};

/**
 * Every live problem on this companion, live before dormant and most severe
 * first.
 *
 * NOT paginated, and not for lack of a helper. This is one animal's problem
 * list: the set is bounded by what a clinician has actually recorded, the PIMS
 * list it mirrors is unpaged for the same reason, and a page boundary in a
 * problem list is a way to silently withhold the row that mattered.
 *
 * Ordering keeps the PIMS list's `status` ascending - Prisma orders an enum by
 * its declared order, and `ProblemStatus` is declared ACTIVE, INACTIVE,
 * RESOLVED - and inserts severity above the dates, for the reason the allergy
 * list does: a phone shows three rows without scrolling. `severity` and
 * `onsetDate` are both nullable, so both name `nulls: "last"` explicitly.
 * Postgres sorts NULLs FIRST on a descending order, which would otherwise float
 * the rows carrying the least information to the top of the screen.
 *
 * There is NO organisation filter, and that is the point rather than an
 * oversight. The row names `patientId` directly, the caller has already been
 * proven an ACTIVE parent link with `medicalRecords` on that exact patient by
 * `requireCompanionPermission`, and an animal seen by a second practice has its
 * problems recorded under that practice's `organisationId`. Filtering by one
 * org would hide exactly the record the owner cannot get any other way - the
 * PIMS view is org-scoped and therefore structurally cannot show it.
 * `organisationId` goes out on each row instead, so the client can say who
 * recorded it.
 *
 * `notes`, `recordedBy` and `encounterId` are not selected. The first is the
 * practice's own working text, the second a staff id and the third a pointer
 * into the practice's own records; none of the three is the owner's, and the
 * PIMS select is not reused wholesale for that reason.
 */
export const listProblemsForCompanion = async (
  patientId: string,
): Promise<MobilePatientProblem[]> => {
  // A falsy id must never reach a `where`: Prisma drops an `undefined` field
  // rather than matching nothing, and `{ patientId: undefined }` would return
  // every problem in the database. The middleware guards this too; the cost of
  // being wrong is high enough to guard it twice.
  if (!patientId) {
    return [];
  }

  const rows = await prisma.patientProblem.findMany({
    where: {
      patientId,
      status: { in: OWNER_VISIBLE_PROBLEM_STATUSES },
    },
    select: {
      id: true,
      patientId: true,
      organisationId: true,
      name: true,
      codeSystem: true,
      code: true,
      status: true,
      severity: true,
      onsetDate: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [
      { status: "asc" },
      { severity: { sort: "desc", nulls: "last" } },
      { onsetDate: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
  });

  return rows.map((row) => ({
    id: row.id,
    patientId: row.patientId,
    organisationId: row.organisationId,
    name: row.name,
    // `?? undefined` rather than passing the null through: the field is
    // optional on the wire, and JSON.stringify drops an undefined but emits a
    // null, so a client checking presence would see a code that is there and
    // empty.
    codeSystem: row.codeSystem ?? undefined,
    code: row.code ?? undefined,
    status: row.status,
    severity: row.severity ?? undefined,
    onsetDate: row.onsetDate?.toISOString(),
    // Named for what it is to the reader rather than for the column. The row's
    // `createdAt` is when the practice wrote it down, which is not when the
    // animal fell ill - that is `onsetDate`, and it is nullable because it is
    // often unknown.
    recordedAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
};

export const MobilePatientProblemService = {
  listProblemsForCompanion,
};
