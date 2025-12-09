// src/services/task.recurrence.engine.ts
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import cronParser from "cron-parser";

dayjs.extend(utc);
dayjs.extend(timezone);

import TaskModel, { TaskDocument } from "src/models/task";

type RecurrenceType = "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";

const MAX_HORIZON_DAYS = 30;
const MAX_CHILDREN_PER_RUN = 50;

export class TaskRecurrenceEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskRecurrenceEngineError";
  }
}

// Computes next dueAt
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
      return base.add(1, "day").toDate();

    case "WEEKLY":
      return base.add(1, "week").toDate();

    case "CUSTOM":
      if (!cronExpression) return null;

      try {
        const interval = cronParser.parse(cronExpression, {
          currentDate: base.toDate(),
          tz: timezone ?? "UTC",
        });

        return interval.next().toDate();
      } catch (error) {
        console.error("Invalid cron expression:", cronExpression, error);
        return null;
      }

    default:
      return null;
  }
};

// Clone task for new occurrence
const cloneFromMaster = (master: TaskDocument, dueAt: Date) => {
  const m = master.toObject();

  return {
    organisationId: m.organisationId,
    appointmentId: m.appointmentId,

    companionId: m.companionId,

    createdBy: m.createdBy,
    assignedBy: m.assignedBy,
    assignedTo: m.assignedTo,

    audience: m.audience,

    source: m.source,
    libraryTaskId: m.libraryTaskId,
    templateId: m.templateId,

    category: m.category,
    name: m.name,
    description: m.description,

    medication: m.medication,
    observationToolId: m.observationToolId,

    dueAt,
    timezone: m.timezone,

    recurrence: {
      type: m.recurrence?.type,
      isMaster: false,
      masterTaskId: master._id.toString(),
      cronExpression: m.recurrence?.cronExpression,
      endDate: m.recurrence?.endDate,
    },

    reminder: m.reminder
      ? {
          enabled: m.reminder.enabled,
          offsetMinutes: m.reminder.offsetMinutes,
        }
      : undefined,

    syncWithCalendar: m.syncWithCalendar ?? false,

    attachments: m.attachments,

    status: "PENDING",
  };
};

export const TaskRecurrenceEngine = {
  async run() {
    const now = dayjs();
    const horizon = now.add(MAX_HORIZON_DAYS, "day");

    const masters = await TaskModel.find({
      "recurrence.isMaster": true,
      "recurrence.type": { $ne: "ONCE" },
      status: { $ne: "CANCELLED" },

      $or: [
        { "recurrence.endDate": { $exists: false } },
        { "recurrence.endDate": null },
        { "recurrence.endDate": { $gte: now.toDate() } },
      ],
    });

    for (const master of masters) {
      const recurrence = master.recurrence!;
      const type = recurrence.type;

      // Find last occurrence
      const lastChild = await TaskModel.findOne({
        "recurrence.masterTaskId": master._id.toString(),
      })
        .sort({ dueAt: -1 })
        .lean();

      let currentDueAt = lastChild?.dueAt ?? master.dueAt;

      let generatedCount = 0;

      while (generatedCount < MAX_CHILDREN_PER_RUN) {
        const nextDueAt = computeNextDueAt(
          type,
          currentDueAt,
          master.timezone,
          recurrence.cronExpression,
        );

        if (!nextDueAt) break;

        const next = dayjs(nextDueAt);

        if (next.isAfter(horizon)) break;

        if (recurrence.endDate && next.isAfter(recurrence.endDate)) break;

        // Skip if already exists
        const exists = await TaskModel.findOne({
          "recurrence.masterTaskId": master._id.toString(),
          dueAt: next.toDate(),
        }).lean();

        if (!exists) {
          const payload = cloneFromMaster(master, next.toDate());
          await TaskModel.create(payload);
        }

        currentDueAt = next.toDate();
        generatedCount++;
      }
    }
  },
};
