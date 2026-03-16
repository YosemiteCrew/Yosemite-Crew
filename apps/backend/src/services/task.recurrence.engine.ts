// src/services/task.recurrence.engine.ts
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import cronParser from "cron-parser";

dayjs.extend(utc);
dayjs.extend(timezone);

import TaskModel, { TaskDocument } from "src/models/task";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import { Prisma, TaskAudience, TaskSource, TaskStatus } from "@prisma/client";
import { isReadFromPostgres } from "src/config/read-switch";

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

const cloneFromMasterPrisma = (
  master: {
    organisationId: string | null;
    appointmentId: string | null;
    companionId: string | null;
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
  companionId: master.companionId ?? undefined,
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
      masterTaskId: (master as { id?: string }).id ?? undefined,
      cronExpression: recurrenceBase["cronExpression"] ?? undefined,
      endDate: recurrenceBase["endDate"] ?? undefined,
    } as Prisma.InputJsonValue;
  })(),
  reminder: master.reminder ?? undefined,
  syncWithCalendar: master.syncWithCalendar ?? undefined,
  attachments: master.attachments ?? undefined,
  status: "PENDING" as TaskStatus,
});

const syncTaskToPostgres = async (doc: TaskDocument) => {
  if (!shouldDualWrite) return;
  try {
    const obj = doc.toObject() as {
      _id: { toString(): string };
      organisationId?: string;
      appointmentId?: string;
      companionId?: string;
      createdBy: string;
      assignedBy?: string;
      assignedTo: string;
      audience: string;
      source: string;
      libraryTaskId?: string;
      templateId?: string;
      category: string;
      name: string;
      description?: string;
      medication?: unknown;
      observationToolId?: string;
      dueAt: Date;
      timezone?: string;
      recurrence?: unknown;
      reminder?: unknown;
      syncWithCalendar?: boolean;
      calendarEventId?: string;
      attachments?: unknown;
      status: string;
      completedAt?: Date;
      completedBy?: string;
      createdAt?: Date;
      updatedAt?: Date;
    };

    await prisma.task.upsert({
      where: { id: obj._id.toString() },
      create: {
        id: obj._id.toString(),
        organisationId: obj.organisationId ?? undefined,
        appointmentId: obj.appointmentId ?? undefined,
        companionId: obj.companionId ?? undefined,
        createdBy: obj.createdBy,
        assignedBy: obj.assignedBy ?? undefined,
        assignedTo: obj.assignedTo,
        audience: obj.audience as TaskAudience,
        source: obj.source as TaskSource,
        libraryTaskId: obj.libraryTaskId ?? undefined,
        templateId: obj.templateId ?? undefined,
        category: obj.category,
        name: obj.name,
        description: obj.description ?? undefined,
        medication: (obj.medication ??
          undefined) as unknown as Prisma.InputJsonValue,
        observationToolId: obj.observationToolId ?? undefined,
        dueAt: obj.dueAt,
        timezone: obj.timezone ?? undefined,
        recurrence: (obj.recurrence ??
          undefined) as unknown as Prisma.InputJsonValue,
        reminder: (obj.reminder ??
          undefined) as unknown as Prisma.InputJsonValue,
        syncWithCalendar: obj.syncWithCalendar ?? undefined,
        calendarEventId: obj.calendarEventId ?? undefined,
        attachments: (obj.attachments ??
          undefined) as unknown as Prisma.InputJsonValue,
        status: obj.status as TaskStatus,
        completedAt: obj.completedAt ?? undefined,
        completedBy: obj.completedBy ?? undefined,
        createdAt: obj.createdAt ?? undefined,
        updatedAt: obj.updatedAt ?? undefined,
      },
      update: {
        status: obj.status as TaskStatus,
        completedAt: obj.completedAt ?? undefined,
        completedBy: obj.completedBy ?? undefined,
        updatedAt: obj.updatedAt ?? undefined,
      },
    });
  } catch (err) {
    handleDualWriteError("Task recurrence", err);
  }
};

export const TaskRecurrenceEngine = {
  async run() {
    const now = dayjs();
    const horizon = now.add(MAX_HORIZON_DAYS, "day");

    if (isReadFromPostgres()) {
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

      return;
    }

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
        const next = getNextOccurrence(
          type,
          currentDueAt,
          master.timezone,
          recurrence.cronExpression,
          horizon,
          recurrence.endDate,
        );

        if (!next) break;

        // Skip if already exists
        const exists = await TaskModel.findOne({
          "recurrence.masterTaskId": master._id.toString(),
          dueAt: next.toDate(),
        }).lean();

        if (!exists) {
          const payload = cloneFromMaster(master, next.toDate());
          const doc = await TaskModel.create(payload);
          await syncTaskToPostgres(doc);
        }

        currentDueAt = next.toDate();
        generatedCount++;
      }
    }
  },
};
