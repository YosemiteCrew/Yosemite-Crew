// src/services/vaccine.reminder.engine.ts
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import { prisma } from "src/config/prisma";
import { NotificationService } from "src/services/notification.service";
import { NotificationTemplates } from "src/utils/notificationTemplates";
import logger from "src/utils/logger";

dayjs.extend(utc);

// How far ahead of a vaccination's next-due date we start reminding the owner.
const REMINDER_WINDOW_DAYS = 14;

type ReminderMetadata = {
  vaccineReminder?: { sentForDueDate?: string };
};

const readMetadata = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

// Resolves the user id of the pet's primary, active owner (the mobile-app
// account) so the reminder can be delivered. Returns null when the pet has no
// linked owner account to notify.
const resolveOwnerUserId = async (
  patientId: string,
): Promise<string | null> => {
  const link = await prisma.parentPatient.findFirst({
    where: { patientId, role: "PRIMARY", status: "ACTIVE" },
    select: { parentId: true },
  });
  if (!link) return null;
  const parent = await prisma.parent.findUnique({
    where: { id: link.parentId },
    select: { linkedUserId: true },
  });
  return parent?.linkedUserId ?? null;
};

/**
 * Handles one due immunization. Extracted from the loop in run() so each guard
 * reads as a single early return rather than stacking cognitive complexity in
 * the iteration body (Sonar S3776).
 *
 * Returns nothing: every reason to skip is a normal outcome, not an error.
 */
const remindForImmunization = async (immunization: {
  id: string;
  nextDueDate: Date | null;
  metadata: unknown;
  artifact: { encounterId: string | null };
}): Promise<void> => {
  const dueDate = immunization.nextDueDate;
  if (!dueDate) return;
  const dueIso = dueDate.toISOString();

  const metadata = readMetadata(immunization.metadata);
  if ((metadata as ReminderMetadata).vaccineReminder?.sentForDueDate === dueIso)
    return;

  const encounterId = immunization.artifact.encounterId;
  if (!encounterId) return;

  const encounter = await prisma.encounter.findUnique({
    where: { id: encounterId },
    select: { patientId: true },
  });
  if (!encounter) return;

  const patient = await prisma.patient.findUnique({
    where: { id: encounter.patientId },
    select: { name: true, status: true },
  });
  // Never chase a vaccination for a pet that has been recorded deceased or
  // otherwise deactivated.
  if (patient?.status !== "active") return;

  const ownerUserId = await resolveOwnerUserId(encounter.patientId);
  if (!ownerUserId) return;

  // Claim the reminder BEFORE delivering it. Sending first and recording after
  // is at-least-once: the caller swallows a failed write, and because run()
  // re-selects everything due inside the window, a persistent write failure
  // would re-notify the owner once a day until the due date passes. The
  // conditional updateMany also makes a concurrent run a no-op rather than a
  // second push.
  const claimed = await prisma.immunization.updateMany({
    where: {
      id: immunization.id,
      NOT: {
        metadata: {
          path: ["vaccineReminder", "sentForDueDate"],
          equals: dueIso,
        },
      },
    },
    data: {
      metadata: { ...metadata, vaccineReminder: { sentForDueDate: dueIso } },
    },
  });
  if (claimed.count === 0) return;

  await NotificationService.sendToUser(
    ownerUserId,
    NotificationTemplates.Care.VACCINE_REMINDER(patient.name),
  );
};

export const VaccineReminderEngine = {
  /**
   * Notifies pet owners about vaccinations whose next-due date falls within the
   * reminder window. Only signed (passport-valid) immunizations are considered,
   * and each due date is reminded at most once (tracked in the record metadata).
   * Runs daily.
   */
  async run() {
    const now = dayjs.utc();
    const windowEnd = now.add(REMINDER_WINDOW_DAYS, "day");

    const due = await prisma.immunization.findMany({
      where: {
        nextDueDate: { gte: now.toDate(), lte: windowEnd.toDate() },
        artifact: { status: "SIGNED" },
      },
      include: { artifact: { select: { encounterId: true } } },
    });

    for (const immunization of due) {
      try {
        await remindForImmunization(immunization);
      } catch (error) {
        logger.error(
          `Failed vaccine reminder for immunization ${immunization.id}`,
          error,
        );
      }
    }
  },
};
