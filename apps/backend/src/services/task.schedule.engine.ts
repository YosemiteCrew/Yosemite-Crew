import { Prisma, TaskScheduleStatus, TemplateKind } from "@prisma/client";
import { prisma } from "src/config/prisma";
import { TaskService } from "./task.service";

type StoredTaskWorkflowSeed = {
  source: "YC_LIBRARY" | "ORG_TEMPLATE" | "CUSTOM";
  templateId?: string;
  organisationId: string;
  appointmentId?: string;
  patientId?: string;
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

function assertTaskWorkflowSeedShape(
  seed: Record<string, unknown>,
): asserts seed is Record<string, unknown> & {
  organisationId: string;
  createdBy: string;
  assignedTo: string;
  category: string;
  name: string;
  dueAt: string;
} {
  if (
    typeof seed.organisationId !== "string" ||
    typeof seed.createdBy !== "string" ||
    typeof seed.assignedTo !== "string" ||
    typeof seed.category !== "string" ||
    typeof seed.name !== "string" ||
    typeof seed.dueAt !== "string"
  ) {
    throw new TaskScheduleEngineError("Invalid schedule seed payload");
  }
}

const normalizeWorkflowRecurrence = (
  recurrence: unknown,
): StoredTaskWorkflowSeed["recurrence"] | undefined => {
  if (!recurrence || typeof recurrence !== "object") {
    return undefined;
  }

  const seedRecurrence = recurrence as Record<string, unknown>;

  return {
    type:
      seedRecurrence.type === "DAILY" ||
      seedRecurrence.type === "WEEKLY" ||
      seedRecurrence.type === "CUSTOM"
        ? seedRecurrence.type
        : "ONCE",
    isMaster: Boolean(seedRecurrence.isMaster),
    masterTaskId:
      typeof seedRecurrence.masterTaskId === "string"
        ? seedRecurrence.masterTaskId
        : undefined,
    cronExpression:
      typeof seedRecurrence.cronExpression === "string"
        ? seedRecurrence.cronExpression
        : undefined,
    endDate:
      typeof seedRecurrence.endDate === "string"
        ? seedRecurrence.endDate
        : undefined,
  };
};

const normalizeWorkflowReminder = (
  reminder: unknown,
): StoredTaskWorkflowSeed["reminder"] | undefined => {
  if (!reminder || typeof reminder !== "object") {
    return undefined;
  }

  const seedReminder = reminder as Record<string, unknown>;

  return {
    enabled: Boolean(seedReminder.enabled),
    offsetMinutes:
      typeof seedReminder.offsetMinutes === "number"
        ? seedReminder.offsetMinutes
        : 0,
    scheduledNotificationId:
      typeof seedReminder.scheduledNotificationId === "string"
        ? seedReminder.scheduledNotificationId
        : undefined,
  };
};

const parseSeed = (value: unknown): StoredTaskWorkflowSeed => {
  if (!value || typeof value !== "object") {
    throw new TaskScheduleEngineError("Invalid schedule seed payload");
  }

  const seed = value as Record<string, unknown>;
  assertTaskWorkflowSeedShape(seed);

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
    patientId: typeof seed.patientId === "string" ? seed.patientId : undefined,
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
    recurrence: normalizeWorkflowRecurrence(seed.recurrence),
    reminder: normalizeWorkflowReminder(seed.reminder),
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

const toWorkflowSeedInput = (seed: StoredTaskWorkflowSeed) => ({
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
});

const materializeSchedule = async (
  schedule: {
    id: string;
    templateKind: TemplateKind;
    generatedTaskIds: unknown;
    materializedSeeds: unknown;
  },
  now: Date,
) => {
  if (isNonEmptyStringArray(schedule.generatedTaskIds)) {
    return;
  }

  if (
    !Array.isArray(schedule.materializedSeeds) ||
    schedule.materializedSeeds.length === 0
  ) {
    return;
  }

  const seeds = schedule.materializedSeeds.map(parseSeed);
  const generatedTaskIds: string[] = [];

  for (const seed of seeds) {
    const task = await TaskService.createFromWorkflowSeed(
      toWorkflowSeedInput(seed),
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
};

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
        await materializeSchedule(schedule, now);
      } catch (error) {
        console.error("Failed to process task schedule", schedule.id, error);
      }
    }
  },
};
