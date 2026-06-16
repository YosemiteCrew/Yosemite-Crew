import { Prisma, TaskScheduleStatus, TemplateKind } from "@prisma/client";
import { prisma } from "src/config/prisma";
import { TaskService } from "./task.service";

type StoredTaskWorkflowSeed = {
  source: "YC_LIBRARY" | "ORG_TEMPLATE" | "CUSTOM";
  templateId?: string;
  organisationId: string;
  appointmentId?: string;
  companionId?: string;
  createdBy: string;
  assignedBy?: string;
  assignedTo: string;
  audience: "EMPLOYEE_TASK" | "PARENT_TASK";
  libraryTaskId?: string;
  category: string;
  name: string;
  description?: string;
  additionalNotes?: string;
  medication?: {
    name?: string;
    type?: string;
    dosage?: string;
    frequency?: string;
    notes?: string;
  };
  observationToolId?: string;
  dueAt: string;
  timezone?: string;
  recurrence?: {
    type: "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";
    isMaster: boolean;
    masterTaskId?: string;
    cronExpression?: string;
    endDate?: string;
  };
  reminder?: {
    enabled: boolean;
    offsetMinutes: number;
    scheduledNotificationId?: string;
  };
  syncWithCalendar?: boolean;
  calendarEventId?: string;
  attachments?: Array<{ id: string; name: string }>;
};

export class TaskScheduleEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskScheduleEngineError";
  }
}

const isNonEmptyStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((item) => typeof item === "string" && item.trim().length > 0);

const parseSeed = (value: unknown): StoredTaskWorkflowSeed => {
  if (!value || typeof value !== "object") {
    throw new TaskScheduleEngineError("Invalid schedule seed payload");
  }

  const seed = value as Record<string, unknown>;

  if (
    typeof seed.organisationId !== "string" ||
    typeof seed.createdBy !== "string"
  ) {
    throw new TaskScheduleEngineError("Invalid schedule seed payload");
  }

  if (
    typeof seed.assignedTo !== "string" ||
    typeof seed.category !== "string"
  ) {
    throw new TaskScheduleEngineError("Invalid schedule seed payload");
  }

  if (typeof seed.name !== "string" || typeof seed.dueAt !== "string") {
    throw new TaskScheduleEngineError("Invalid schedule seed payload");
  }

  const recurrence =
    seed.recurrence && typeof seed.recurrence === "object"
      ? (seed.recurrence as Record<string, unknown>)
      : null;
  const reminder =
    seed.reminder && typeof seed.reminder === "object"
      ? (seed.reminder as Record<string, unknown>)
      : null;

  return {
    source:
      seed.source === "YC_LIBRARY" || seed.source === "CUSTOM"
        ? seed.source
        : "ORG_TEMPLATE",
    templateId:
      typeof seed.templateId === "string" ? seed.templateId : undefined,
    organisationId: seed.organisationId,
    appointmentId:
      typeof seed.appointmentId === "string" ? seed.appointmentId : undefined,
    companionId:
      typeof seed.companionId === "string" ? seed.companionId : undefined,
    createdBy: seed.createdBy,
    assignedBy:
      typeof seed.assignedBy === "string" ? seed.assignedBy : undefined,
    assignedTo: seed.assignedTo,
    audience: seed.audience === "PARENT_TASK" ? "PARENT_TASK" : "EMPLOYEE_TASK",
    libraryTaskId:
      typeof seed.libraryTaskId === "string" ? seed.libraryTaskId : undefined,
    category: seed.category,
    name: seed.name,
    description:
      typeof seed.description === "string" ? seed.description : undefined,
    additionalNotes:
      typeof seed.additionalNotes === "string"
        ? seed.additionalNotes
        : undefined,
    medication:
      seed.medication && typeof seed.medication === "object"
        ? (seed.medication as StoredTaskWorkflowSeed["medication"])
        : undefined,
    observationToolId:
      typeof seed.observationToolId === "string"
        ? seed.observationToolId
        : undefined,
    dueAt: seed.dueAt,
    timezone: typeof seed.timezone === "string" ? seed.timezone : undefined,
    recurrence: recurrence
      ? {
          type:
            recurrence.type === "DAILY" ||
            recurrence.type === "WEEKLY" ||
            recurrence.type === "CUSTOM"
              ? recurrence.type
              : "ONCE",
          isMaster: Boolean(recurrence.isMaster),
          masterTaskId:
            typeof recurrence.masterTaskId === "string"
              ? recurrence.masterTaskId
              : undefined,
          cronExpression:
            typeof recurrence.cronExpression === "string"
              ? recurrence.cronExpression
              : undefined,
          endDate:
            typeof recurrence.endDate === "string"
              ? recurrence.endDate
              : undefined,
        }
      : undefined,
    reminder: reminder
      ? {
          enabled: Boolean(reminder.enabled),
          offsetMinutes:
            typeof reminder.offsetMinutes === "number"
              ? reminder.offsetMinutes
              : 0,
          scheduledNotificationId:
            typeof reminder.scheduledNotificationId === "string"
              ? reminder.scheduledNotificationId
              : undefined,
        }
      : undefined,
    syncWithCalendar:
      typeof seed.syncWithCalendar === "boolean"
        ? seed.syncWithCalendar
        : undefined,
    calendarEventId:
      typeof seed.calendarEventId === "string"
        ? seed.calendarEventId
        : undefined,
    attachments: Array.isArray(seed.attachments)
      ? (seed.attachments as Array<{ id: string; name: string }>)
      : undefined,
  };
};

const scheduleStatusForTemplateKind = (
  kind: TemplateKind,
): TaskScheduleStatus =>
  kind === TemplateKind.TASK_TEMPLATE ? "COMPLETED" : "ACTIVE";

export const TaskScheduleEngine = {
  async run() {
    const now = new Date();
    const schedules = await prisma.taskSchedule.findMany({
      where: {
        status: { in: ["DRAFT", "ACTIVE"] as TaskScheduleStatus[] },
        activatedAt: { lte: now },
      },
      orderBy: [{ activatedAt: "asc" }, { updatedAt: "asc" }],
    });

    for (const schedule of schedules) {
      try {
        if (isNonEmptyStringArray(schedule.generatedTaskIds)) {
          continue;
        }

        const seedsValue = schedule.materializedSeeds;
        if (!Array.isArray(seedsValue) || seedsValue.length === 0) {
          continue;
        }

        const seeds = seedsValue.map(parseSeed);
        const generatedTaskIds: string[] = [];

        for (const seed of seeds) {
          const task = await TaskService.createFromWorkflowSeed(
            {
              ...seed,
              dueAt: new Date(seed.dueAt),
              recurrence: seed.recurrence
                ? {
                    ...seed.recurrence,
                    endDate: seed.recurrence.endDate
                      ? new Date(seed.recurrence.endDate)
                      : undefined,
                  }
                : undefined,
            },
            { notify: false },
          );
          generatedTaskIds.push(task.id);
        }

        await prisma.taskSchedule.update({
          where: { id: schedule.id },
          data: {
            generatedTaskIds: generatedTaskIds as Prisma.InputJsonValue,
            status: scheduleStatusForTemplateKind(schedule.templateKind),
            completedAt:
              schedule.templateKind === TemplateKind.TASK_TEMPLATE ? now : null,
            lastMaterializedAt: now,
          },
        });
      } catch (error) {
        console.error("Failed to process task schedule", schedule.id, error);
      }
    }
  },
};
