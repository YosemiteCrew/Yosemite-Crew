// src/services/vaccine.reminder.engine.ts
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import { Prisma } from "@prisma/client";
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
        const dueDate = immunization.nextDueDate;
        if (!dueDate) continue;
        const dueIso = dueDate.toISOString();

        const metadata = readMetadata(immunization.metadata);
        const reminder = (metadata as ReminderMetadata).vaccineReminder;
        if (reminder?.sentForDueDate === dueIso) continue;

        const encounterId = immunization.artifact.encounterId;
        if (!encounterId) continue;
        const encounter = await prisma.encounter.findUnique({
          where: { id: encounterId },
          select: { patientId: true },
        });
        if (!encounter) continue;

        const patient = await prisma.patient.findUnique({
          where: { id: encounter.patientId },
          select: { name: true },
        });
        if (!patient) continue;

        const ownerUserId = await resolveOwnerUserId(encounter.patientId);
        if (!ownerUserId) continue;

        await NotificationService.sendToUser(
          ownerUserId,
          NotificationTemplates.Care.VACCINE_REMINDER(patient.name),
        );

        await prisma.immunization.update({
          where: { id: immunization.id },
          data: {
            metadata: {
              ...metadata,
              vaccineReminder: { sentForDueDate: dueIso },
            } as Prisma.InputJsonValue,
          },
        });
      } catch (error) {
        logger.error(
          `Failed vaccine reminder for immunization ${immunization.id}`,
          error,
        );
      }
    }
  },
};
