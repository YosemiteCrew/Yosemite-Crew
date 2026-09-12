// src/services/task.recurrence.engine.ts
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import cronParser from "cron-parser";

import { Prisma, TaskAudience, TaskSource, TaskStatus } from "@prisma/client";
import { prisma } from "src/config/prisma";

dayjs.extend(utc);
dayjs.extend(timezone);

type RecurrenceType = "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY" | "CUSTOM";

const MAX_HORIZON_DAYS = 30;
const MAX_CHILDREN_PER_RUN = 50;

export class TaskRecurrenceEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskRecurrenceEngineError";
  }
}

// Calendar month length is timezone-independent, so this needs no tz plugin.
const daysInMonth = (year: number, month0: number): number =>
  new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();

// Monthly recurrence anchors to the ORIGINAL calendar day, not "same day next
// month": if a target month is too short for that day, skip it entirely and
// keep looking rather than clamping (Jan 31 -> Mar 31, never Feb 28).
const addMonthlyRecurrence = (
  base: dayjs.Dayjs,
  taskTimezone: string | undefined,
): dayjs.Dayjs => {
  const originalDay = base.date();
  let year = base.year();
  let month = base.month();

  do {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  } while (daysInMonth(year, month) < originalDay);

  // dayjs's tz-aware setters (.date()/.month()/.year()) keep the UTC offset
  // captured when .tz() was first called instead of recomputing it for the
  // new date, so stepping across a DST boundary that way silently mislabels
  // the instant by the DST delta. Rebuilding the wall-clock string and
  // reparsing through dayjs.tz() forces a fresh offset lookup instead.
  const pad = (value: number, length = 2) =>
    String(value).padStart(length, "0");
  const wallClock = `${year}-${pad(month + 1)}-${pad(originalDay)}T${pad(
    base.hour(),
  )}:${pad(base.minute())}:${pad(base.second())}.${pad(base.millisecond(), 3)}`;

  return taskTimezone ? dayjs.tz(wallClock, taskTimezone) : dayjs(wallClock);
};

export const computeNextDueAt = (
  recurrenceType: RecurrenceType,
  previousDueAt: Date,
  timezone: string | undefined,
  cronExpression?: string | null,
): Date | null => {
  const base = timezone
    ? dayjs(previousDueAt).tz(timezone)
    : dayjs(previousDueAt);

  switch (recurrenceType) {
    case "ONCE":
      return null;
    case "DAILY":
      return base.add(1, "day").toDate();
    case "WEEKLY":
      return base.add(1, "week").toDate();
    case "MONTHLY":
      return addMonthlyRecurrence(base, timezone).toDate();
    case "CUSTOM":
      if (!cronExpression) return null;
      try {
        const interval = cronParser.parse(cronExpression, {
          currentDate: base.toDate(),
          tz: timezone ?? "UTC",
        });
        return interval.next().toDate();
      } catch (error) {
        // The expression is caller-supplied; strip line breaks so it cannot
        // forge additional log lines. Two constraints on the form: no quantifier,
        // and an empty replacement, or CodeQL's log-injection barrier does not
        // fire. String() matters: the task controllers spread req.body straight
        // through, so a stored cronExpression need not be a string, and a bare
        // .replace() would throw here inside the catch and abort the whole
        // engine run. `error` needs no strip: cron fields are
        // whitespace-delimited, so cron-parser's "got value" echo is always a
        // single field and can never contain a break.
        console.error(
          "Invalid cron expression:",
          String(cronExpression).replace(/[\n\r]/g, ""),
          error,
        );
        return null;
      }
    default:
      return null;
  }
};

export const getNextOccurrence = (
  recurrenceType: RecurrenceType,
  previousDueAt: Date,
  timezone: string | undefined,
  cronExpression: string | null | undefined,
  horizon: dayjs.Dayjs,
  endDate?: Date | null,
): dayjs.Dayjs | null => {
  const nextDueAt = computeNextDueAt(
    recurrenceType,
    previousDueAt,
    timezone,
    cronExpression,
  );

  if (!nextDueAt) return null;

  const next = dayjs(nextDueAt);
  if (next.isAfter(horizon)) return null;
  if (endDate && next.isAfter(endDate)) return null;

  return next;
};

const cloneFromMasterPrisma = (
  master: {
    id: string;
    organisationId: string | null;
    appointmentId: string | null;
    patientId: string | null;
    createdBy: string;
    assignedBy: string | null;
    assignedTo: string;
    audience: TaskAudience;
    source: TaskSource;
    libraryTaskId: string | null;
    templateId: string | null;
    category: string;
    name: string;
    description: string | null;
    medication: Prisma.InputJsonValue | null;
    observationToolId: string | null;
    dueAt: Date;
    timezone: string | null;
    recurrence: Prisma.InputJsonValue | null;
    reminder: Prisma.InputJsonValue | null;
    syncWithCalendar: boolean | null;
    attachments: Prisma.InputJsonValue | null;
  },
  dueAt: Date,
) => ({
  organisationId: master.organisationId ?? undefined,
  appointmentId: master.appointmentId ?? undefined,
  patientId: master.patientId ?? undefined,
  createdBy: master.createdBy,
  assignedBy: master.assignedBy ?? undefined,
  assignedTo: master.assignedTo,
  audience: master.audience,
  source: master.source,
  libraryTaskId: master.libraryTaskId ?? undefined,
  templateId: master.templateId ?? undefined,
  category: master.category,
  name: master.name,
  description: master.description ?? undefined,
  medication: master.medication ?? undefined,
  observationToolId: master.observationToolId ?? undefined,
  dueAt,
  timezone: master.timezone ?? undefined,
  recurrence: (() => {
    const recurrenceBase =
      (master.recurrence as Record<string, Prisma.InputJsonValue> | null) ?? {};
    return {
      ...recurrenceBase,
      isMaster: false,
      masterTaskId: master.id,
      cronExpression: recurrenceBase["cronExpression"] ?? undefined,
      endDate: recurrenceBase["endDate"] ?? undefined,
    } as Prisma.InputJsonValue;
  })(),
  reminder: master.reminder ?? undefined,
  syncWithCalendar: master.syncWithCalendar ?? undefined,
  attachments: master.attachments ?? undefined,
  status: "PENDING" as TaskStatus,
});

export const TaskRecurrenceEngine = {
  async run() {
    const now = dayjs();
    const horizon = now.add(MAX_HORIZON_DAYS, "day");

    const masters = await prisma.task.findMany({
      where: {
        status: { not: "CANCELLED" },
      },
    });

    for (const master of masters) {
      const recurrence = master.recurrence as {
        type?: RecurrenceType;
        isMaster?: boolean;
        cronExpression?: string | null;
        endDate?: Date | null;
      } | null;
      if (!recurrence?.isMaster) continue;
      if (!recurrence.type || recurrence.type === "ONCE") continue;

      const lastChild = await prisma.task.findFirst({
        where: { recurrence: { path: ["masterTaskId"], equals: master.id } },
        orderBy: { dueAt: "desc" },
      });

      let currentDueAt = lastChild?.dueAt ?? master.dueAt;
      let generatedCount = 0;

      while (generatedCount < MAX_CHILDREN_PER_RUN) {
        const next = getNextOccurrence(
          recurrence.type,
          currentDueAt,
          master.timezone ?? undefined,
          recurrence.cronExpression ?? undefined,
          horizon,
          recurrence.endDate ?? undefined,
        );

        if (!next) break;

        const exists = await prisma.task.findFirst({
          where: {
            recurrence: { path: ["masterTaskId"], equals: master.id },
            dueAt: next.toDate(),
          },
        });

        if (!exists) {
          const payload = cloneFromMasterPrisma(master, next.toDate());
          await prisma.task.create({ data: payload });
        }

        currentDueAt = next.toDate();
        generatedCount++;
      }
    }
  },
};
