import type { CareReminderStatus, CareReminderType } from "@prisma/client";
import { prisma } from "src/config/prisma";
import { listPermittedPatientIds } from "src/services/mobile-prescription.service";
import { buildCareReminderMessage } from "src/services/shared/care-reminder-message";
import {
  clampPageSize,
  encodeKeysetCursor,
  parseKeysetCursor,
  splitPage,
} from "src/services/shared/pagination";

/**
 * The owner's "what is due" list (#2705).
 *
 * Care reminders were fire-and-forget: the practice created one, we pushed and
 * mailed it, and nothing in the app could tell the owner what their animal was
 * due for afterwards. If the push was missed or dismissed the state was simply
 * invisible. This is the pull surface for the same rows.
 *
 * Kept out of `care-reminder.service` on purpose. That service is scoped by
 * organisation and authorised on staff RBAC - every read there takes an
 * `organisationId` the caller has been proven a member of - and the mobile
 * caller has neither an organisation nor a staff role. The scoping rules are
 * the whole point of this module, so they live in one place.
 */

/**
 * The binding is direct. `CareReminder.patientId` names the companion, so the
 * scope is an `in` over the parent's permitted patients and there is no
 * nullable hop to fail closed on - unlike prescriptions, which can only reach
 * the animal through `encounterId`.
 */

/**
 * An open reminder: something the owner may still need to act on.
 *
 * RESPONDED is done and CANCELLED was withdrawn by the practice, so neither is
 * outstanding. EXPIRED is excluded for the same reason, with one caveat worth
 * stating: nothing in `care-reminder.service` writes EXPIRED today - it is a
 * declared status with no transition into it - so that arm of the filter is
 * exercised by the tests and not yet by production data.
 *
 * SENT is included and PENDING is included, which is the point of the issue:
 * whether a notification went out is delivery accounting, not whether the
 * animal is due.
 */
const OPEN_REMINDER_STATUSES: CareReminderStatus[] = ["PENDING", "SENT"];

/** A phone screen, not a data export. Same bounds as the prescription list. */
export const DEFAULT_CARE_REMINDER_PAGE_SIZE = 20;
export const MAX_CARE_REMINDER_PAGE_SIZE = 100;

/**
 * A `(dueDate, id)` position.
 *
 * Named for its own column rather than reusing the shared `KeysetCursor`
 * directly: that type's date slot is called `createdAt` because the
 * prescription list sorts on it, and a due date sitting in a field named
 * `createdAt` is how the next reader of this file introduces a bug. The wire
 * format is the shared one, so nothing is duplicated but the name - the same
 * adapter `developer-data.service` puts in front of `appointmentDate`.
 */
export type CareReminderCursor = { dueDate: Date; id: string };

export const encodeCareReminderCursor = ({
  dueDate,
  id,
}: CareReminderCursor): string =>
  encodeKeysetCursor({ createdAt: dueDate, id });

/**
 * Three outcomes, like every other cursor parser here: `undefined` for "not
 * sent", `null` for "sent and unusable", the value when it is usable. It is
 * what lets the controller answer 400 for a malformed cursor while leaving
 * every failure from the query itself honestly a 500.
 */
export const parseCareReminderCursor = (
  raw: unknown,
): CareReminderCursor | undefined | null => {
  const keyset = parseKeysetCursor(raw);
  if (!keyset) {
    return keyset;
  }
  return { dueDate: keyset.createdAt, id: keyset.id };
};

export type MobileCareReminder = {
  id: string;
  patientId: string;
  patientName: string;
  organisationId: string;
  reminderType: CareReminderType;
  /** The same sentence the push and the email carried. */
  message: string;
  dueDate: string;
  /** Strictly `dueDate < now`. See `listDueCareRemindersForParent`. */
  overdue: boolean;
  status: CareReminderStatus;
  sentAt?: string;
};

export type MobileCareReminderPage = {
  reminders: MobileCareReminder[];
  nextCursor: string | null;
  /** Whether another page exists. Never inferred from `reminders.length`. */
  hasMore: boolean;
  /** The page size actually applied, which is not always the one requested. */
  limit: number;
};

export type ListDueCareRemindersOptions = {
  /** Clamped, never rejected. See `clampPageSize`. */
  limit?: unknown;
  cursor?: CareReminderCursor;
  /** Injected so the overdue boundary is testable. Defaults to now. */
  now?: Date;
};

/**
 * Open care reminders for the parent's companions, soonest due first.
 *
 * Ordering is `(dueDate, id)` ascending, not newest-first. Overdue items have
 * the earliest due dates, so they sort to the top on the reminder's own
 * schedule - which is the distinction the issue asks for, and it is drawn from
 * `dueDate` rather than from `status`/`sentAt`, so a reminder nobody managed to
 * deliver still reads as overdue.
 *
 * `overdue` is a strict instant comparison against one `now` captured for the
 * whole page, so two rows either side of the request cannot disagree about what
 * time it is. It is an INSTANT, not a local calendar day: a reminder due at
 * midnight UTC flips to overdue at midnight UTC, which is the previous evening
 * for a caller west of it. `dueDate` is returned in full so the client renders
 * the local-day wording from the device's own zone - deliberately not computed
 * here, where the caller's zone is not known.
 *
 * `CareReminderOptOut` is NOT consulted, and that is the product decision the
 * issue asked to be made on purpose rather than by accident. An opt-out is an
 * objection to being *contacted* by a practice - GDPR Art. 21, recorded against
 * an email address by the unsubscribe link. This list is not a contact: the
 * owner opened it. Suppressing it would mean that unsubscribing from a
 * practice's email silently removed every trace that the animal is due for
 * anything, which is the failure this endpoint exists to fix.
 */
export const listDueCareRemindersForParent = async (
  parentId: string,
  options: ListDueCareRemindersOptions = {},
): Promise<MobileCareReminderPage> => {
  const limit = clampPageSize(options.limit, {
    defaultSize: DEFAULT_CARE_REMINDER_PAGE_SIZE,
    maxSize: MAX_CARE_REMINDER_PAGE_SIZE,
  });
  const empty: MobileCareReminderPage = {
    reminders: [],
    nextCursor: null,
    hasMore: false,
    limit,
  };

  const patientIds = await listPermittedPatientIds(parentId);
  if (patientIds.length === 0) {
    return empty;
  }

  /*
   * The next page is an exclusive comparison in the `where`, not Prisma's
   * `cursor` + `skip: 1`. The pair looks equivalent and is not: `skip` is an
   * OFFSET on the filtered result, so once the cursor row leaves the filter -
   * which happens here the moment the practice cancels a reminder or marks it
   * responded - the OFFSET eats a legitimate row instead, and `hasMore: false`
   * then claims the list was complete. This form is exclusive by construction.
   *
   * The cursor is a position, never an access grant: `patientId: { in: ... }`
   * is rebuilt from the parent's links on every page, so a cursor lifted from
   * another parent's response moves the window and widens nothing.
   */
  const rows = await prisma.careReminder.findMany({
    where: {
      patientId: { in: patientIds },
      status: { in: OPEN_REMINDER_STATUSES },
      ...(options.cursor
        ? {
            OR: [
              { dueDate: { gt: options.cursor.dueDate } },
              {
                dueDate: options.cursor.dueDate,
                id: { gt: options.cursor.id },
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      patientId: true,
      organisationId: true,
      reminderType: true,
      customMessage: true,
      dueDate: true,
      status: true,
      sentAt: true,
    },
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
    take: limit + 1,
  });

  /*
   * Split before mapping, so the cursor is the last row the query returned for
   * this page rather than the last row that survived the mapping below. A row
   * dropped as unmappable would otherwise be handed back as the next page's
   * starting point and re-dropped forever.
   */
  const { items, nextCursor, hasMore } = splitPage(rows, limit, (row) =>
    encodeCareReminderCursor({ dueDate: row.dueDate, id: row.id }),
  );
  if (items.length === 0) {
    return { ...empty, nextCursor, hasMore };
  }

  /*
   * `CareReminder` has no relation to `Patient`, so the name is a second read
   * rather than an `include`. It is bounded by the parent's own links, not by
   * the page, because two reminders on one animal must not ask twice.
   */
  const patients = await prisma.patient.findMany({
    where: { id: { in: [...new Set(items.map((row) => row.patientId))] } },
    select: { id: true, name: true },
  });
  const nameByPatient = new Map(patients.map((p) => [p.id, p.name]));

  const now = options.now ?? new Date();

  const reminders = items.flatMap((row) => {
    const patientName = nameByPatient.get(row.patientId);
    // Narrowing only. The ids came from this parent's own ACTIVE links, so a
    // miss would mean the patient row vanished between the two reads; dropping
    // it is safer than emitting a reminder with no animal attached to it.
    if (patientName === undefined) {
      return [];
    }

    return [
      {
        id: row.id,
        patientId: row.patientId,
        patientName,
        organisationId: row.organisationId,
        reminderType: row.reminderType,
        message: buildCareReminderMessage({
          customMessage: row.customMessage,
          patientName,
          reminderType: row.reminderType,
        }),
        dueDate: row.dueDate.toISOString(),
        overdue: row.dueDate.getTime() < now.getTime(),
        status: row.status,
        sentAt: row.sentAt?.toISOString(),
        // `notes` and `createdBy` are deliberately absent. Neither reaches the
        // parent on the send path: `notes` is the practice's own working text
        // and `createdBy` is a staff id.
      },
    ];
  });

  return { reminders, nextCursor, hasMore, limit };
};

export const MobileCareReminderService = {
  listDueCareRemindersForParent,
};
