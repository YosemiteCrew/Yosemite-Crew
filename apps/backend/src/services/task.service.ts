import {
  Prisma,
  TaskAudience as PrismaTaskAudience,
  TaskSource as PrismaTaskSource,
  TaskStatus as PrismaTaskStatus,
} from "@prisma/client";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { TaskWorkflowSeed } from "./task-workflow-materializer";
import { sendEmailTemplate } from "../utils/email";
import logger from "../utils/logger";

export class TaskServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "TaskServiceError";
  }
}

export type TaskAudience = "EMPLOYEE_TASK" | "PARENT_TASK";
export type TaskSource = "YC_LIBRARY" | "ORG_TEMPLATE" | "CUSTOM";
export type TaskStatus = PrismaTaskStatus;

export type MedicationDoseInput = {
  time?: string;
  dosage?: string;
  instructions?: string;
};

export type MedicationInput = {
  name?: string;
  type?: string;
  notes?: string;
  frequency?: string;
  doses?: MedicationDoseInput[];
};

const SUPPORT_EMAIL_ADDRESS =
  process.env.SUPPORT_EMAIL ??
  process.env.SUPPORT_EMAIL_ADDRESS ??
  process.env.HELP_EMAIL ??
  "support@yosemitecrew.com";
const DEFAULT_PMS_URL =
  process.env.PMS_BASE_URL ??
  process.env.FRONTEND_BASE_URL ??
  process.env.APP_URL ??
  "https://app.yosemitecrew.com";

const TASK_STATUSES = new Set<TaskStatus>([
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

const TASK_AUDIENCES = new Set<TaskAudience>(["EMPLOYEE_TASK", "PARENT_TASK"]);

type TaskRow = Prisma.TaskGetPayload<Record<string, never>>;
type TaskCompletionRow = Prisma.TaskCompletionGetPayload<Record<string, never>>;

type TaskLike = TaskRow & { _id: string };
type TaskCompletionLike = TaskCompletionRow & { _id: string };

const toTaskLike = (row: TaskRow): TaskLike => ({
  ...row,
  _id: row.id,
});

const toTaskCompletionLike = (row: TaskCompletionRow): TaskCompletionLike => ({
  ...row,
  _id: row.id,
});

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

const toNullableJsonInput = (
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullTypes.DbNull | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
};

const sanitizeStatusList = (value: unknown): TaskStatus[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const filtered = value.filter(
    (status): status is TaskStatus =>
      typeof status === "string" && TASK_STATUSES.has(status as TaskStatus),
  );
  return filtered.length ? filtered : undefined;
};

const sanitizeAudience = (value: unknown): TaskAudience | undefined =>
  typeof value === "string" && TASK_AUDIENCES.has(value as TaskAudience)
    ? (value as TaskAudience)
    : undefined;

const buildDisplayName = (
  user?: { firstName?: string | null; lastName?: string | null } | null,
) => {
  if (!user) return undefined;
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
};

type TaskAssignmentEmailTask = {
  audience: TaskAudience;
  assignedTo?: string | null;
  assignedGroupId?: string | null;
  assignedBy?: string | null;
  createdBy: string;
  companionId?: string | null;
  dueAt: Date;
  name: string;
  additionalNotes?: string | null;
};

const sendTaskAssignmentEmail = async (task: TaskAssignmentEmailTask) => {
  if (task.audience !== "EMPLOYEE_TASK") return;
  if (task.assignedGroupId) return;
  if (!task.assignedTo) return;
  logger.info("Sending task assigned email");
  try {
    const [assignee, assigner, companion] = await Promise.all([
      prisma.user.findFirst({
        where: { userId: task.assignedTo },
        select: { email: true, firstName: true, lastName: true },
      }),
      prisma.user.findFirst({
        where: { userId: task.assignedBy ?? task.createdBy },
        select: { firstName: true, lastName: true },
      }),
      task.companionId
        ? prisma.companion.findFirst({
            where: { id: task.companionId },
            select: { name: true },
          })
        : Promise.resolve(null),
    ]);

    if (!assignee?.email) return;

    const dueTime = task.dueAt.toUTCString();

    await sendEmailTemplate({
      to: assignee.email,
      templateId: "taskAssigned",
      templateData: {
        employeeName: buildDisplayName(assignee),
        taskName: task.name,
        companionName: companion?.name ?? undefined,
        dueTime,
        assignedByName: buildDisplayName(assigner),
        additionalNotes: task.additionalNotes ?? undefined,
        ctaUrl: DEFAULT_PMS_URL,
        ctaLabel: "Open PMS",
        supportEmail: SUPPORT_EMAIL_ADDRESS,
      },
    });
  } catch (error) {
    logger.error("Failed to send task assignment email.", error);
  }
};

const recordTaskAudit = async (params: {
  organisationId?: string | null;
  companionId?: string | null;
  eventType: "TASK_CREATED" | "TASK_REASSIGNED" | "TASK_STATUS_CHANGED";
  actorId?: string | null;
  entityId: string;
  metadata?: Record<string, unknown>;
}) => {
  if (!params.organisationId || !params.companionId) {
    return;
  }

  await AuditTrailService.recordSafely({
    organisationId: params.organisationId,
    companionId: params.companionId,
    actorType: params.actorId ? "PMS_USER" : "SYSTEM",
    actorId: params.actorId ?? undefined,
    eventType: params.eventType,
    entityType: "TASK",
    entityId: params.entityId,
    metadata: params.metadata,
  });
};

const assertCanUpdateTask = (isCreator: boolean, isAssignee: boolean) => {
  if (!isCreator && !isAssignee) {
    throw new TaskServiceError("Not allowed to update this task", 403);
  }
};

const normalizeDoseTime = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  if (!/^\d{2}:\d{2}$/.test(t)) return undefined;
  return t;
};

const sanitizeMedication = (input?: MedicationInput | null) => {
  if (!input) return undefined;

  const doses =
    Array.isArray(input.doses) && input.doses.length
      ? input.doses
          .map((d) => ({
            time: normalizeDoseTime(d.time),
            dosage: typeof d.dosage === "string" ? d.dosage.trim() : undefined,
            instructions:
              typeof d.instructions === "string"
                ? d.instructions.trim()
                : undefined,
          }))
          .filter((d) => d.time || d.dosage || d.instructions)
      : undefined;

  const name = typeof input.name === "string" ? input.name.trim() : undefined;
  const type = typeof input.type === "string" ? input.type.trim() : undefined;
  const notes =
    typeof input.notes === "string" ? input.notes.trim() : undefined;
  const frequency =
    typeof input.frequency === "string" ? input.frequency.trim() : undefined;

  if (
    !name &&
    !type &&
    !notes &&
    !frequency &&
    (!doses || doses.length === 0)
  ) {
    return undefined;
  }

  return {
    name,
    type,
    notes,
    frequency,
    doses: doses?.length ? doses : undefined,
  };
};

const assertCompanionRequirement = (input: {
  audience: TaskAudience;
  companionId?: string;
  medication?: MedicationInput;
  observationToolId?: string;
}) => {
  const requiresCompanion =
    input.audience === "PARENT_TASK" ||
    !!input.observationToolId ||
    !!sanitizeMedication(input.medication);

  if (requiresCompanion && !input.companionId) {
    throw new TaskServiceError(
      "companionId is required for parent, medication, or observation tool tasks",
      400,
    );
  }
};

const buildRecurrence = (input?: {
  type: "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";
  endDate?: Date;
  cronExpression?: string;
}) => {
  if (!input) return undefined;

  if (input.type === "ONCE") {
    return {
      type: "ONCE",
      isMaster: false,
      masterTaskId: undefined,
      cronExpression: undefined,
      endDate: undefined,
    };
  }

  return {
    type: input.type,
    isMaster: true,
    masterTaskId: undefined,
    cronExpression: input.cronExpression,
    endDate: input.endDate,
  };
};

const mergeRecurrence = (
  existing: unknown,
  input?: {
    type: "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";
    endDate?: Date | null;
    cronExpression?: string | null;
  } | null,
) => {
  if (input === undefined) return undefined;
  if (input === null) return Prisma.DbNull;

  const existingRecurrence =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};

  if (input.type === "ONCE") {
    return {
      type: "ONCE",
      isMaster: false,
      masterTaskId:
        typeof existingRecurrence.masterTaskId === "string"
          ? existingRecurrence.masterTaskId
          : undefined,
      cronExpression: undefined,
      endDate: undefined,
    };
  }

  return {
    type: input.type,
    isMaster:
      typeof existingRecurrence.isMaster === "boolean"
        ? existingRecurrence.isMaster
        : true,
    masterTaskId:
      typeof existingRecurrence.masterTaskId === "string"
        ? existingRecurrence.masterTaskId
        : undefined,
    cronExpression:
      input.cronExpression === undefined
        ? (existingRecurrence.cronExpression as string | undefined)
        : (input.cronExpression ?? undefined),
    endDate:
      input.endDate === undefined
        ? (existingRecurrence.endDate as Date | undefined)
        : (input.endDate ?? undefined),
  };
};

const buildReminder = (
  input?: { enabled: boolean; offsetMinutes: number } | null,
) =>
  input
    ? {
        enabled: input.enabled,
        offsetMinutes: input.offsetMinutes,
        scheduledNotificationId: undefined,
      }
    : undefined;

const buildCreateTaskData = (input: {
  organisationId?: string;
  appointmentId?: string;
  companionId?: string;
  createdBy: string;
  assignedBy?: string;
  assignedTo: string;
  assignedGroupId?: string | null;
  audience: TaskAudience;
  source: TaskSource;
  libraryTaskId?: string;
  templateId?: string;
  category: string;
  name: string;
  description?: string;
  additionalNotes?: string;
  medication?: MedicationInput;
  observationToolId?: string;
  dueAt: Date;
  timezone?: string;
  recurrence?: {
    type: "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";
    endDate?: Date;
    cronExpression?: string;
  };
  reminder?: {
    enabled: boolean;
    offsetMinutes: number;
  } | null;
  syncWithCalendar?: boolean;
  attachments?: {
    id: string;
    name: string;
  }[];
}) => ({
  organisationId: input.organisationId ?? undefined,
  appointmentId: input.appointmentId ?? undefined,
  companionId: input.companionId ?? undefined,
  createdBy: input.createdBy,
  assignedBy: input.assignedBy ?? input.createdBy,
  assignedTo: input.assignedTo,
  assignedGroupId: input.assignedGroupId ?? undefined,
  audience: input.audience as PrismaTaskAudience,
  source: input.source as PrismaTaskSource,
  libraryTaskId: input.libraryTaskId ?? undefined,
  templateId: input.templateId ?? undefined,
  category: input.category,
  name: input.name,
  description: input.description ?? undefined,
  additionalNotes: input.additionalNotes ?? undefined,
  medication: toNullableJsonInput(sanitizeMedication(input.medication)),
  observationToolId: input.observationToolId ?? undefined,
  dueAt: input.dueAt,
  timezone: input.timezone ?? undefined,
  recurrence: toNullableJsonInput(buildRecurrence(input.recurrence)),
  reminder: toNullableJsonInput(buildReminder(input.reminder)),
  syncWithCalendar: input.syncWithCalendar ?? false,
  calendarEventId: undefined,
  attachments: toNullableJsonInput(input.attachments ?? []),
  status: "PENDING" as PrismaTaskStatus,
});

type TaskWriteClient = Pick<Prisma.TransactionClient, "task">;

const createTaskRow = async (
  client: TaskWriteClient,
  input: Parameters<typeof buildCreateTaskData>[0],
) => {
  const doc = await client.task.create({
    data: buildCreateTaskData(input),
  });

  return toTaskLike(doc);
};

const updateTaskRow = async (
  taskId: string,
  updates: {
    name?: string;
    description?: string;
    additionalNotes?: string;
    dueAt?: Date;
    timezone?: string | null;
    assignedTo?: string;
    assignedGroupId?: string | null;
    assignedBy?: string;
    medication?: MedicationInput | null;
    observationToolId?: string | null;
    reminder?: {
      enabled: boolean;
      offsetMinutes: number;
    } | null;
    syncWithCalendar?: boolean;
    attachments?: {
      id: string;
      name: string;
    }[];
    recurrence?: {
      type: "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";
      endDate?: Date | null;
      cronExpression?: string | null;
    } | null;
  },
  task: TaskRow & {
    recurrence: Prisma.JsonValue | null;
  },
) =>
  prisma.task.update({
    where: { id: taskId },
    data: {
      name: updates.name ?? task.name,
      description:
        updates.description === undefined
          ? (task.description ?? undefined)
          : (updates.description ?? undefined),
      additionalNotes:
        updates.additionalNotes === undefined
          ? (task.additionalNotes ?? undefined)
          : (updates.additionalNotes ?? undefined),
      dueAt: updates.dueAt ?? task.dueAt,
      timezone:
        updates.timezone === undefined
          ? (task.timezone ?? undefined)
          : (updates.timezone ?? undefined),
      assignedTo: updates.assignedTo ?? task.assignedTo,
      assignedGroupId:
        updates.assignedGroupId === undefined
          ? (task.assignedGroupId ?? undefined)
          : (updates.assignedGroupId ?? undefined),
      assignedBy:
        updates.assignedBy === undefined
          ? (task.assignedBy ?? undefined)
          : (updates.assignedBy ?? undefined),
      medication:
        updates.medication === undefined
          ? (task.medication ?? undefined)
          : toNullableJsonInput(sanitizeMedication(updates.medication)),
      observationToolId:
        updates.observationToolId === undefined
          ? (task.observationToolId ?? undefined)
          : (updates.observationToolId ?? undefined),
      reminder:
        updates.reminder === undefined
          ? (task.reminder ?? undefined)
          : toNullableJsonInput(buildReminder(updates.reminder)),
      syncWithCalendar:
        updates.syncWithCalendar ?? task.syncWithCalendar ?? undefined,
      attachments:
        updates.attachments === undefined
          ? (task.attachments ?? undefined)
          : toNullableJsonInput(updates.attachments),
      recurrence: mergeRecurrence(task.recurrence, updates.recurrence),
    },
  });

export interface BaseTaskCreateInput {
  organisationId?: string;
  appointmentId?: string;
  companionId?: string;
  createdBy: string;
  assignedBy?: string;
  assignedTo: string;
  assignedGroupId?: string | null;
  dueAt: Date;
  timezone?: string;
  medication?: MedicationInput;
  observationToolId?: string;
  recurrence?: {
    type: "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";
    endDate?: Date;
    cronExpression?: string;
  };
  reminder?: {
    enabled: boolean;
    offsetMinutes: number;
  };
  syncWithCalendar?: boolean;
  attachments?: {
    id: string;
    name: string;
  }[];
}

export interface CreateFromLibraryInput extends BaseTaskCreateInput {
  audience: TaskAudience;
  libraryTaskId: string;
  categoryOverride?: string;
  nameOverride?: string;
  descriptionOverride?: string;
}

export interface CreateFromTemplateInput extends BaseTaskCreateInput {
  templateId: string;
  categoryOverride?: string;
  nameOverride?: string;
  descriptionOverride?: string;
  audienceOverride?: TaskAudience;
}

export interface CreateCustomTaskInput extends BaseTaskCreateInput {
  audience: TaskAudience;
  category: string;
  name: string;
  description?: string;
  additionalNotes?: string;
}

export interface TaskUpdateInput {
  name?: string;
  description?: string;
  additionalNotes?: string;
  dueAt?: Date;
  timezone?: string | null;
  assignedTo?: string;
  assignedGroupId?: string | null;
  medication?: MedicationInput | null;
  observationToolId?: string | null;
  reminder?: {
    enabled: boolean;
    offsetMinutes: number;
  } | null;
  syncWithCalendar?: boolean;
  attachments?: {
    id: string;
    name: string;
  }[];
  recurrence?: {
    type: "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";
    endDate?: Date | null;
    cronExpression?: string | null;
  } | null;
}

export interface CompleteTaskInput {
  filledBy: string;
  answers?: Record<string, unknown>;
  score?: number;
  summary?: string;
}

export const TaskService = {
  async createFromLibrary(input: CreateFromLibraryInput): Promise<TaskLike> {
    const library = await prisma.taskLibraryDefinition.findFirst({
      where: { id: input.libraryTaskId, isActive: true },
    });

    if (!library) {
      throw new TaskServiceError("Library task not found or inactive", 404);
    }

    assertCompanionRequirement({
      audience: input.audience,
      companionId: input.companionId,
      medication: input.medication,
      observationToolId: input.observationToolId,
    });

    const doc = await prisma.task.create({
      data: buildCreateTaskData({
        organisationId: input.organisationId,
        appointmentId: input.appointmentId,
        companionId: input.companionId,
        createdBy: input.createdBy,
        assignedBy: input.assignedBy,
        assignedTo: input.assignedTo,
        assignedGroupId: input.assignedGroupId,
        audience: input.audience,
        source: "YC_LIBRARY",
        libraryTaskId: input.libraryTaskId,
        category: input.categoryOverride ?? library.category,
        name: input.nameOverride ?? library.name,
        description:
          input.descriptionOverride ?? library.defaultDescription ?? undefined,
        medication: input.medication,
        observationToolId: input.observationToolId ?? undefined,
        dueAt: input.dueAt,
        timezone: input.timezone,
        recurrence: input.recurrence,
        reminder: input.reminder,
        syncWithCalendar: input.syncWithCalendar,
        attachments: input.attachments,
      }),
    });

    const mapped = toTaskLike(doc);
    await recordTaskAudit({
      organisationId: mapped.organisationId,
      companionId: mapped.companionId,
      actorId: mapped.createdBy,
      eventType: "TASK_CREATED",
      entityId: mapped.id,
      metadata: {
        source: mapped.source,
        audience: mapped.audience,
        assignedTo: mapped.assignedTo,
        assignedGroupId: mapped.assignedGroupId ?? null,
        status: mapped.status,
      },
    });
    void sendTaskAssignmentEmail(mapped);
    return mapped;
  },

  async createFromTemplate(input: CreateFromTemplateInput): Promise<TaskLike> {
    const template = await prisma.taskTemplate.findFirst({
      where: { id: input.templateId, isActive: true },
    });

    if (!template) {
      throw new TaskServiceError("Task template not found or inactive", 404);
    }

    if (template.organisationId !== input.organisationId) {
      throw new TaskServiceError(
        "Template does not belong to organisation",
        400,
      );
    }

    const audience: TaskAudience =
      input.audienceOverride ??
      (template.defaultRole === "PARENT" ? "PARENT_TASK" : "EMPLOYEE_TASK");

    const templateMedication = (template.defaultMedication ?? undefined) as
      | MedicationInput
      | undefined;

    assertCompanionRequirement({
      audience,
      companionId: input.companionId,
      medication: input.medication ?? templateMedication,
      observationToolId:
        input.observationToolId ??
        template.defaultObservationToolId ??
        undefined,
    });

    const recurrence =
      input.recurrence ??
      (template.defaultRecurrence
        ? {
            type: (
              template.defaultRecurrence as {
                type: "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";
              }
            ).type,
            endDate:
              (template.defaultRecurrence as { defaultEndOffsetDays?: number })
                .defaultEndOffsetDays == null
                ? undefined
                : new Date(
                    input.dueAt.getTime() +
                      ((
                        template.defaultRecurrence as {
                          defaultEndOffsetDays?: number;
                        }
                      ).defaultEndOffsetDays ?? 0) *
                        24 *
                        60 *
                        60 *
                        1000,
                  ),
            cronExpression: (
              template.defaultRecurrence as { customCron?: string }
            ).customCron,
          }
        : undefined);

    const reminder =
      input.reminder ??
      (template.defaultReminderOffsetMinutes == null
        ? undefined
        : {
            enabled: true,
            offsetMinutes: template.defaultReminderOffsetMinutes,
          });

    const doc = await prisma.task.create({
      data: buildCreateTaskData({
        organisationId: input.organisationId,
        appointmentId: input.appointmentId,
        companionId: input.companionId,
        createdBy: input.createdBy,
        assignedBy: input.assignedBy,
        assignedTo: input.assignedTo,
        assignedGroupId: input.assignedGroupId,
        audience,
        source: "ORG_TEMPLATE",
        libraryTaskId: template.libraryTaskId ?? undefined,
        templateId: template.id,
        category: input.categoryOverride ?? template.category,
        name: input.nameOverride ?? template.name,
        description:
          input.descriptionOverride ?? template.description ?? undefined,
        medication: input.medication ?? templateMedication,
        observationToolId:
          input.observationToolId ??
          template.defaultObservationToolId ??
          undefined,
        dueAt: input.dueAt,
        timezone: input.timezone,
        recurrence,
        reminder,
        syncWithCalendar: input.syncWithCalendar,
        attachments: input.attachments,
      }),
    });

    const mapped = toTaskLike(doc);
    await recordTaskAudit({
      organisationId: mapped.organisationId,
      companionId: mapped.companionId,
      actorId: mapped.createdBy,
      eventType: "TASK_CREATED",
      entityId: mapped.id,
      metadata: {
        source: mapped.source,
        audience: mapped.audience,
        assignedTo: mapped.assignedTo,
        assignedGroupId: mapped.assignedGroupId ?? null,
        status: mapped.status,
      },
    });
    void sendTaskAssignmentEmail(mapped);
    return mapped;
  },

  async createCustom(input: CreateCustomTaskInput): Promise<TaskLike> {
    if (!input.category || !input.name) {
      throw new TaskServiceError("category and name are required", 400);
    }

    assertCompanionRequirement({
      audience: input.audience,
      companionId: input.companionId,
      medication: input.medication,
      observationToolId: input.observationToolId,
    });

    const doc = await prisma.task.create({
      data: buildCreateTaskData({
        organisationId: input.organisationId,
        appointmentId: input.appointmentId,
        companionId: input.companionId,
        createdBy: input.createdBy,
        assignedBy: input.assignedBy,
        assignedTo: input.assignedTo,
        assignedGroupId: input.assignedGroupId,
        audience: input.audience,
        source: "CUSTOM",
        category: input.category,
        name: input.name,
        description: input.description,
        additionalNotes: input.additionalNotes,
        medication: input.medication,
        observationToolId: input.observationToolId,
        dueAt: input.dueAt,
        timezone: input.timezone,
        recurrence: input.recurrence,
        reminder: input.reminder,
        syncWithCalendar: input.syncWithCalendar,
        attachments: input.attachments,
      }),
    });

    const mapped = toTaskLike(doc);
    await recordTaskAudit({
      organisationId: mapped.organisationId,
      companionId: mapped.companionId,
      actorId: mapped.createdBy,
      eventType: "TASK_CREATED",
      entityId: mapped.id,
      metadata: {
        source: mapped.source,
        audience: mapped.audience,
        assignedTo: mapped.assignedTo,
        assignedGroupId: mapped.assignedGroupId ?? null,
        status: mapped.status,
      },
    });
    void sendTaskAssignmentEmail(mapped);
    return mapped;
  },

  async createFromWorkflowSeed(
    input: TaskWorkflowSeed,
    options?: { client?: TaskWriteClient; notify?: boolean },
  ): Promise<TaskLike> {
    assertCompanionRequirement({
      audience: input.audience,
      companionId: input.companionId,
      medication: input.medication,
      observationToolId: input.observationToolId,
    });

    const mapped = await createTaskRow(options?.client ?? prisma, {
      organisationId: input.organisationId,
      appointmentId: input.appointmentId,
      companionId: input.companionId,
      createdBy: input.createdBy,
      assignedBy: input.assignedBy,
      assignedTo: input.assignedTo,
      audience: input.audience,
      source: input.source,
      libraryTaskId: input.libraryTaskId,
      templateId: input.templateId,
      category: input.category,
      name: input.name,
      description: input.description,
      additionalNotes: input.additionalNotes,
      medication: input.medication,
      observationToolId: input.observationToolId,
      dueAt: input.dueAt,
      timezone: input.timezone,
      recurrence: input.recurrence
        ? {
            type: input.recurrence.type,
            endDate: input.recurrence.endDate,
            cronExpression: input.recurrence.cronExpression,
          }
        : undefined,
      reminder: input.reminder,
      syncWithCalendar: input.syncWithCalendar,
      attachments: input.attachments,
    });

    if (options?.notify !== false) {
      void sendTaskAssignmentEmail(mapped);
    }

    await recordTaskAudit({
      organisationId: mapped.organisationId,
      companionId: mapped.companionId,
      actorId: mapped.createdBy,
      eventType: "TASK_CREATED",
      entityId: mapped.id,
      metadata: {
        source: mapped.source,
        audience: mapped.audience,
        assignedTo: mapped.assignedTo,
        assignedGroupId: mapped.assignedGroupId ?? null,
        status: mapped.status,
      },
    });

    return mapped;
  },

  async updateTask(
    taskId: string,
    updates: TaskUpdateInput,
    actorId: string,
  ): Promise<TaskLike> {
    const task = await prisma.task.findFirst({ where: { id: taskId } });
    if (!task) throw new TaskServiceError("Task not found", 404);

    const isCreator = task.createdBy === actorId;
    const isAssignee = task.assignedTo === actorId;
    assertCanUpdateTask(isCreator, isAssignee);

    if (updates.assignedTo !== undefined) {
      if (!isCreator) {
        throw new TaskServiceError("Only task creator can reassign task", 403);
      }
    }

    if (updates.assignedGroupId !== undefined && !isCreator) {
      throw new TaskServiceError("Only task creator can reassign task", 403);
    }

    const updated = await updateTaskRow(
      taskId,
      {
        name: updates.name,
        description: updates.description,
        additionalNotes: updates.additionalNotes,
        dueAt: updates.dueAt,
        timezone: updates.timezone,
        assignedTo: updates.assignedTo,
        assignedGroupId: updates.assignedGroupId,
        assignedBy:
          updates.assignedTo !== undefined ||
          updates.assignedGroupId !== undefined
            ? actorId
            : undefined,
        medication: updates.medication,
        observationToolId: updates.observationToolId,
        reminder: updates.reminder,
        syncWithCalendar: updates.syncWithCalendar,
        attachments: updates.attachments,
        recurrence: updates.recurrence,
      },
      task,
    );

    const mapped = toTaskLike(updated);

    if (
      updates.assignedTo !== undefined ||
      updates.assignedGroupId !== undefined
    ) {
      await recordTaskAudit({
        organisationId: mapped.organisationId,
        companionId: mapped.companionId,
        actorId,
        eventType: "TASK_REASSIGNED",
        entityId: mapped.id,
        metadata: {
          previousAssignedTo: task.assignedTo,
          previousAssignedGroupId: task.assignedGroupId ?? null,
          assignedTo: mapped.assignedTo,
          assignedGroupId: mapped.assignedGroupId ?? null,
          assignedBy: mapped.assignedBy ?? null,
        },
      });
    }

    return mapped;
  },

  async changeStatus(
    taskId: string,
    newStatus: TaskStatus,
    actorId: string,
    completion?: CompleteTaskInput,
  ): Promise<{ task: TaskLike; completion?: TaskCompletionLike }> {
    const task = await prisma.task.findFirst({ where: { id: taskId } });
    if (!task) throw new TaskServiceError("Task not found", 404);

    if (task.assignedTo !== actorId && task.createdBy !== actorId) {
      throw new TaskServiceError("Not allowed to update this task", 403);
    }

    if (task.status === "CANCELLED" || task.status === "COMPLETED") {
      throw new TaskServiceError("Task already finished", 400);
    }

    let nextStatus: PrismaTaskStatus;
    let completedAt: Date | null = task.completedAt ?? null;
    let completedBy: string | null = task.completedBy ?? null;

    if (newStatus === "IN_PROGRESS" && task.status === "PENDING") {
      nextStatus = "IN_PROGRESS";
    } else if (newStatus === "COMPLETED") {
      nextStatus = "COMPLETED";
      completedAt = new Date();
      completedBy = actorId;
    } else if (newStatus === "CANCELLED") {
      nextStatus = "CANCELLED";
    } else if (newStatus === "PENDING") {
      nextStatus = "PENDING";
    } else {
      nextStatus = newStatus;
    }

    let completionDoc: TaskCompletionLike | undefined;

    if (newStatus === "COMPLETED" && completion?.answers) {
      if (!task.companionId) {
        throw new TaskServiceError(
          "Companion is required for completion.",
          400,
        );
      }
      const created = await prisma.taskCompletion.create({
        data: {
          taskId: task.id,
          companionId: task.companionId,
          filledBy: completion.filledBy ?? actorId,
          answers: completion.answers as unknown as Prisma.InputJsonValue,
          score: completion.score ?? undefined,
          summary: completion.summary ?? undefined,
        },
      });
      completionDoc = toTaskCompletionLike(created);
    }

    const updated = await prisma.task.update({
      where: { id: task.id },
      data: {
        status: nextStatus,
        completedAt,
        completedBy,
      },
    });

    const mapped = {
      task: toTaskLike(updated),
      completion: completionDoc,
    };

    await recordTaskAudit({
      organisationId: updated.organisationId,
      companionId: updated.companionId,
      actorId,
      eventType: "TASK_STATUS_CHANGED",
      entityId: updated.id,
      metadata: {
        previousStatus: task.status,
        nextStatus,
        completedBy,
      },
    });

    return mapped;
  },

  async getById(taskId: string): Promise<TaskLike | null> {
    const task = await prisma.task.findFirst({
      where: { id: taskId },
    });
    return task ? toTaskLike(task) : null;
  },

  async listForParent(params: {
    parentId: string;
    companionId?: string;
    fromDueAt?: Date;
    toDueAt?: Date;
    status?: TaskStatus[];
  }): Promise<TaskLike[]> {
    const parentId = asNonEmptyString(params.parentId);
    if (!parentId) {
      throw new TaskServiceError("Invalid parentId");
    }

    const where: Prisma.TaskWhereInput = {
      audience: "PARENT_TASK",
      OR: [{ assignedTo: parentId }, { createdBy: parentId }],
    };

    const companionId = asNonEmptyString(params.companionId);
    if (companionId) where.companionId = companionId;

    const status = sanitizeStatusList(params.status);
    if (status) where.status = { in: status };

    const fromDueAt = isValidDate(params.fromDueAt)
      ? params.fromDueAt
      : undefined;
    const toDueAt = isValidDate(params.toDueAt) ? params.toDueAt : undefined;
    if (fromDueAt || toDueAt) {
      where.dueAt = {};
      if (fromDueAt) where.dueAt.gte = fromDueAt;
      if (toDueAt) where.dueAt.lte = toDueAt;
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { dueAt: "asc" },
    });
    return tasks.map(toTaskLike);
  },

  async listForEmployee(params: {
    organisationId: string;
    userId?: string;
    companionId?: string;
    fromDueAt?: Date;
    toDueAt?: Date;
    status?: TaskStatus[];
  }): Promise<TaskLike[]> {
    const organisationId = asNonEmptyString(params.organisationId);
    if (!organisationId) {
      throw new TaskServiceError("Invalid organisationId");
    }

    const where: Prisma.TaskWhereInput = {
      audience: "EMPLOYEE_TASK",
      organisationId,
    };

    const userId = asNonEmptyString(params.userId);
    if (userId) where.assignedTo = userId;

    const companionId = asNonEmptyString(params.companionId);
    if (companionId) where.companionId = companionId;

    const status = sanitizeStatusList(params.status);
    if (status) where.status = { in: status };

    const fromDueAt = isValidDate(params.fromDueAt)
      ? params.fromDueAt
      : undefined;
    const toDueAt = isValidDate(params.toDueAt) ? params.toDueAt : undefined;
    if (fromDueAt || toDueAt) {
      where.dueAt = {};
      if (fromDueAt) where.dueAt.gte = fromDueAt;
      if (toDueAt) where.dueAt.lte = toDueAt;
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { dueAt: "asc" },
    });
    return tasks.map(toTaskLike);
  },

  async listForGroup(params: {
    organisationId: string;
    groupId: string;
    companionId?: string;
    fromDueAt?: Date;
    toDueAt?: Date;
    status?: TaskStatus[];
  }): Promise<TaskLike[]> {
    const organisationId = asNonEmptyString(params.organisationId);
    if (!organisationId) {
      throw new TaskServiceError("Invalid organisationId");
    }

    const groupId = asNonEmptyString(params.groupId);
    if (!groupId) {
      throw new TaskServiceError("Invalid groupId");
    }

    const where: Prisma.TaskWhereInput = {
      organisationId,
      assignedGroupId: groupId,
    };

    const companionId = asNonEmptyString(params.companionId);
    if (companionId) where.companionId = companionId;

    const status = sanitizeStatusList(params.status);
    if (status) where.status = { in: status };

    const fromDueAt = isValidDate(params.fromDueAt)
      ? params.fromDueAt
      : undefined;
    const toDueAt = isValidDate(params.toDueAt) ? params.toDueAt : undefined;
    if (fromDueAt || toDueAt) {
      where.dueAt = {};
      if (fromDueAt) where.dueAt.gte = fromDueAt;
      if (toDueAt) where.dueAt.lte = toDueAt;
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { dueAt: "asc" },
    });
    return tasks.map(toTaskLike);
  },

  async listForCompanion(params: {
    companionId: string;
    organisationId?: string;
    audience?: TaskAudience;
    fromDueAt?: Date;
    toDueAt?: Date;
    status?: TaskStatus[];
  }): Promise<TaskLike[]> {
    const companionId = asNonEmptyString(params.companionId);
    if (!companionId) {
      throw new TaskServiceError("Invalid companionId");
    }

    const where: Prisma.TaskWhereInput = {
      companionId,
    };

    const organisationId = asNonEmptyString(params.organisationId);
    if (organisationId) where.organisationId = organisationId;

    const audience = sanitizeAudience(params.audience);
    if (audience) where.audience = audience;

    const status = sanitizeStatusList(params.status);
    if (status) where.status = { in: status };

    const fromDueAt = isValidDate(params.fromDueAt)
      ? params.fromDueAt
      : undefined;
    const toDueAt = isValidDate(params.toDueAt) ? params.toDueAt : undefined;
    if (fromDueAt || toDueAt) {
      where.dueAt = {};
      if (fromDueAt) where.dueAt.gte = fromDueAt;
      if (toDueAt) where.dueAt.lte = toDueAt;
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { dueAt: "asc" },
    });
    return tasks.map(toTaskLike);
  },

  async linkToAppointment(input: {
    taskId: string;
    appointmentId: string;
    enforceSingleTaskPerAppointment?: boolean;
  }): Promise<TaskLike> {
    const task = await prisma.task.findFirst({
      where: { id: input.taskId },
    });
    if (!task) {
      throw new TaskServiceError("Task not found", 404);
    }

    const updated = await prisma.task.update({
      where: { id: input.taskId },
      data: { appointmentId: input.appointmentId },
    });

    return toTaskLike(updated);
  },
};
