// src/services/task.recurrence.engine.ts
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import cronParser from "cron-parser";

import {
  Prisma,
  TaskAudience,
  TaskPriority,
  TaskSource,
  TaskStatus,
} from "@prisma/client";
import { prisma } from "src/config/prisma";

dayjs.extend(utc);
dayjs.extend(timezone);

type RecurrenceType = "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";

const MAX_HORIZON_DAYS = 30;
const MAX_CHILDREN_PER_RUN = 50;

export class TaskRecurrenceEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskRecurrenceEngineError";
  }
}

const computeNextDueAt = (
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
    case "WEEKLY": {
      // `.add()` on a dayjs-tz instant preserves the previous instant's UTC
      // offset instead of recomputing it for the destination date, so it
      // silently shifts local wall-clock time across a DST transition.
      // Re-parsing the target calendar date as a naive local string keeps
      // the same local time of day regardless of offset changes.
      const unit = recurrenceType === "DAILY" ? "day" : "week";
      const target = base.add(1, unit).format("YYYY-MM-DDTHH:mm:ss.SSS");
      return timezone
        ? dayjs.tz(target, timezone).toDate()
        : dayjs(target).toDate();
    }
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

const getNextOccurrence = (
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
    subcategory: string | null;
    name: string;
    description: string | null;
    additionalNotes: string | null;
    medication: Prisma.InputJsonValue | null;
    observationToolId: string | null;
    dueAt: Date;
    timezone: string | null;
    recurrence: Prisma.InputJsonValue | null;
    reminder: Prisma.InputJsonValue | null;
    syncWithCalendar: boolean | null;
    attachments: Prisma.InputJsonValue | null;
    assignedGroupId: string | null;
    priority: TaskPriority | null;
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
  subcategory: master.subcategory ?? undefined,
  name: master.name,
  description: master.description ?? undefined,
  additionalNotes: master.additionalNotes ?? undefined,
  medication: master.medication ?? undefined,
  observationToolId: master.observationToolId ?? undefined,
  dueAt,
  timezone: master.timezone ?? undefined,
  assignedGroupId: master.assignedGroupId ?? undefined,
  priority: master.priority ?? undefined,
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
  // Reset the sent/notification marker for the new occurrence — copying the
  // parent's reminder verbatim would carry over a scheduledNotificationId
  // set once the parent's own reminder fired, which makes the reminder
  // worker treat this brand-new occurrence as already sent.
  reminder: master.reminder
    ? {
        ...(master.reminder as Record<string, Prisma.InputJsonValue>),
        scheduledNotificationId: undefined,
      }
    : undefined,
  syncWithCalendar: master.syncWithCalendar ?? undefined,
  attachments: master.attachments ?? undefined,
  status: "PENDING" as TaskStatus,
});

export const TaskRecurrenceEngine = {
  async run() {
    const now = dayjs();
    const horizon = now.add(MAX_HORIZON_DAYS, "day");

    // Deliberately not filtered on the master row's own `status`: the master
    // row IS occurrence #1, so cancelling only that occurrence (scope
    // "THIS") would otherwise stop the whole series from generating any
    // further children. A series-level stop is expressed via
    // `recurrence.endDate` (set by the THIS_AND_FOLLOWING/ALL cancel paths
    // in TaskService), which `getNextOccurrence` already honors below.
    const masters = await prisma.task.findMany({
      where: {
        recurrence: { path: ["isMaster"], equals: true },
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
