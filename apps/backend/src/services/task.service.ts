import { Types } from "mongoose";
import TaskModel, {
  TaskDocument,
  TaskStatus,
  RecurrenceType,
} from "../models/task";
import TaskCompletionModel, {
  TaskCompletionDocument,
} from "../models/taskCompletion";
import TaskLibraryDefinitionModel from "../models/taskLibraryDefinition";
import TaskTemplateModel from "../models/taskTemplate";
import CompanionModel from "../models/companion";
import UserModel from "../models/user";
import { sendEmailTemplate } from "../utils/email";
import logger from "../utils/logger";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import { isReadFromPostgres } from "src/config/read-switch";
import {
  Prisma,
  TaskAudience as PrismaTaskAudience,
  TaskSource as PrismaTaskSource,
  TaskStatus as PrismaTaskStatus,
} from "@prisma/client";

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

export type MedicationDoseInput = {
  time?: string; // "08:00"
  dosage?: string; // "5ml"
  instructions?: string; // "after food"
};

export type MedicationInput = {
  name?: string;
  type?: string;
  notes?: string;
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

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

const toPrismaTaskData = (doc: TaskDocument) => {
  const obj = doc.toObject() as {
    _id: { toString(): string };
    organisationId?: string;
    appointmentId?: string;
    companionId?: string;
    createdBy: string;
    assignedBy?: string;
    assignedTo: string;
    audience: TaskAudience;
    source: TaskSource;
    libraryTaskId?: string;
    templateId?: string;
    category: string;
    name: string;
    description?: string;
    additionalNotes?: string;
    medication?: unknown;
    observationToolId?: string;
    dueAt: Date;
    timezone?: string;
    recurrence?: unknown;
    reminder?: unknown;
    syncWithCalendar?: boolean;
    calendarEventId?: string;
    attachments?: unknown;
    status: TaskStatus;
    completedAt?: Date;
    completedBy?: string;
    createdAt?: Date;
    updatedAt?: Date;
  };

  return {
    id: obj._id.toString(),
    organisationId: obj.organisationId ?? undefined,
    appointmentId: obj.appointmentId ?? undefined,
    companionId: obj.companionId ?? undefined,
    createdBy: obj.createdBy,
    assignedBy: obj.assignedBy ?? undefined,
    assignedTo: obj.assignedTo,
    audience: obj.audience as PrismaTaskAudience,
    source: obj.source as PrismaTaskSource,
    libraryTaskId: obj.libraryTaskId ?? undefined,
    templateId: obj.templateId ?? undefined,
    category: obj.category,
    name: obj.name,
    description: obj.description ?? undefined,
    additionalNotes: obj.additionalNotes ?? undefined,
    medication: (obj.medication ??
      undefined) as unknown as Prisma.InputJsonValue,
    observationToolId: obj.observationToolId ?? undefined,
    dueAt: obj.dueAt,
    timezone: obj.timezone ?? undefined,
    recurrence: (obj.recurrence ??
      undefined) as unknown as Prisma.InputJsonValue,
    reminder: (obj.reminder ?? undefined) as unknown as Prisma.InputJsonValue,
    syncWithCalendar: obj.syncWithCalendar ?? undefined,
    calendarEventId: obj.calendarEventId ?? undefined,
    attachments: (obj.attachments ??
      undefined) as unknown as Prisma.InputJsonValue,
    status: obj.status as PrismaTaskStatus,
    completedAt: obj.completedAt ?? undefined,
    completedBy: obj.completedBy ?? undefined,
    createdAt: obj.createdAt ?? undefined,
    updatedAt: obj.updatedAt ?? undefined,
  };
};

const syncTaskToPostgres = async (doc: TaskDocument) => {
  if (!shouldDualWrite) return;
  try {
    const data = toPrismaTaskData(doc);
    await prisma.task.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  } catch (err) {
    handleDualWriteError("Task", err);
  }
};

const syncTaskCompletionToPostgres = async (doc: TaskCompletionDocument) => {
  if (!shouldDualWrite) return;
  try {
    await prisma.taskCompletion.upsert({
      where: { id: doc._id.toString() },
      create: {
        id: doc._id.toString(),
        taskId: doc.taskId,
        companionId: doc.companionId,
        filledBy: doc.filledBy,
        answers: doc.answers as unknown as Prisma.InputJsonValue,
        score: doc.score ?? undefined,
        summary: doc.summary ?? undefined,
        createdAt: doc.createdAt ?? undefined,
      },
      update: {
        answers: doc.answers as unknown as Prisma.InputJsonValue,
        score: doc.score ?? undefined,
        summary: doc.summary ?? undefined,
      },
    });
  } catch (err) {
    handleDualWriteError("TaskCompletion", err);
  }
};

const ensureObjectId = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new TaskServiceError(`Invalid ${field}`, 400);
  }
  if (!isReadFromPostgres() && !Types.ObjectId.isValid(value)) {
    throw new TaskServiceError(`Invalid ${field}`, 400);
  }
  return value;
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
  user?: { firstName?: string; lastName?: string } | null,
) => {
  if (!user) return undefined;
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
};

const sendTaskAssignmentEmail = async (task: TaskDocument) => {
  if (task.audience !== "EMPLOYEE_TASK") return;
  logger.info("Sending task assigned email");
  try {
    const [assignee, assigner, companion] = await Promise.all([
      UserModel.findOne(
        { userId: task.assignedTo },
        { email: 1, firstName: 1, lastName: 1 },
      ).lean(),
      UserModel.findOne(
        { userId: task.assignedBy ?? task.createdBy },
        { firstName: 1, lastName: 1 },
      ).lean(),
      task.companionId
        ? CompanionModel.findById(task.companionId).select("name").lean()
        : Promise.resolve(null),
    ]);

    if (!assignee?.email) return;

    const dueTime = task.dueAt.toUTCString();
    const employeeName = buildDisplayName(assignee);
    const assignedByName = buildDisplayName(assigner);

    await sendEmailTemplate({
      to: assignee.email,
      templateId: "taskAssigned",
      templateData: {
        employeeName,
        taskName: task.name,
        companionName: companion?.name,
        dueTime,
        assignedByName,
        additionalNotes: task.additionalNotes,
        ctaUrl: DEFAULT_PMS_URL,
        ctaLabel: "Open PMS",
        supportEmail: SUPPORT_EMAIL_ADDRESS,
      },
    });
  } catch (error) {
    logger.error("Failed to send task assignment email.", error);
  }
};

const assertCanUpdateTask = (isCreator: boolean, isAssignee: boolean) => {
  if (!isCreator && !isAssignee) {
    throw new TaskServiceError("Not allowed to update this task", 403);
  }
};

const applyAssigneeUpdate = (
  task: TaskDocument,
  updates: TaskUpdateInput,
  isCreator: boolean,
) => {
  // 🔒 Only creator can reassign
  if (updates.assignedTo === undefined) return;
  if (!isCreator) {
    throw new TaskServiceError("Only task creator can reassign task", 403);
  }
  task.assignedTo = updates.assignedTo;
};

const applyFieldUpdates = (task: TaskDocument, updates: TaskUpdateInput) => {
  if (updates.name !== undefined) task.name = updates.name;
  if (updates.description !== undefined) task.description = updates.description;
  if (updates.additionalNotes !== undefined)
    task.additionalNotes = updates.additionalNotes;
  if (updates.dueAt !== undefined) task.dueAt = updates.dueAt;
  if (updates.timezone !== undefined)
    task.timezone = updates.timezone ?? undefined;
  if (updates.medication !== undefined) {
    task.medication =
      updates.medication === null
        ? undefined
        : sanitizeMedication(updates.medication);
  }
  if (updates.observationToolId !== undefined) {
    task.observationToolId = updates.observationToolId ?? undefined;
  }
  if (updates.reminder !== undefined) {
    task.reminder =
      updates.reminder === null
        ? undefined
        : {
            enabled: updates.reminder.enabled,
            offsetMinutes: updates.reminder.offsetMinutes,
            scheduledNotificationId: task.reminder?.scheduledNotificationId,
          };
  }
  if (updates.syncWithCalendar !== undefined) {
    task.syncWithCalendar = updates.syncWithCalendar;
  }
  if (updates.attachments !== undefined) {
    task.attachments = updates.attachments;
  }
};

const applyRecurrenceUpdate = (
  task: TaskDocument,
  updates: TaskUpdateInput,
) => {
  if (updates.recurrence === undefined) return;
  if (updates.recurrence === null) {
    task.recurrence = undefined;
    return;
  }
  if (task.recurrence) {
    task.recurrence.type = updates.recurrence.type;
    task.recurrence.cronExpression =
      updates.recurrence.cronExpression ?? task.recurrence.cronExpression;
    task.recurrence.endDate =
      updates.recurrence.endDate ?? task.recurrence.endDate;
    return;
  }
  task.recurrence = {
    type: updates.recurrence.type,
    isMaster: true,
    masterTaskId: undefined,
    cronExpression: updates.recurrence.cronExpression ?? undefined,
    endDate: updates.recurrence.endDate ?? undefined,
  };
};

const normalizeDoseTime = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  if (!t) return undefined;
  // very lightweight validation: "HH:mm"
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
          .filter(
            (d) => d.time || d.dosage || d.instructions, // drop empty rows
          )
      : undefined;

  const name = typeof input.name === "string" ? input.name.trim() : undefined;
  const type = typeof input.type === "string" ? input.type.trim() : undefined;
  const notes =
    typeof input.notes === "string" ? input.notes.trim() : undefined;

  // If everything is empty, store nothing
  if (!name && !type && !notes && (!doses || doses.length === 0))
    return undefined;

  return {
    name,
    type,
    notes,
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

export interface BaseTaskCreateInput {
  organisationId?: string;
  appointmentId?: string;

  companionId?: string;

  createdBy: string;
  assignedBy?: string;
  assignedTo: string;

  dueAt: Date;
  timezone?: string;

  medication?: MedicationInput;

  observationToolId?: string;

  recurrence?: {
    type: RecurrenceType;
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
    type: RecurrenceType;
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

const buildRecurrence = (input?: {
  type: RecurrenceType;
  endDate?: Date;
  cronExpression?: string;
}): TaskDocument["recurrence"] | undefined => {
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

export const TaskService = {
  async createFromLibrary(
    input: CreateFromLibraryInput,
  ): Promise<TaskDocument> {
    const libraryTaskId = ensureObjectId(input.libraryTaskId, "libraryTaskId");
    const library =
      await TaskLibraryDefinitionModel.findById(libraryTaskId).exec();

    if (!library || !library.isActive) {
      throw new TaskServiceError("Library task not found or inactive", 404);
    }

    assertCompanionRequirement({
      audience: input.audience,
      companionId: input.companionId,
      medication: input.medication,
      observationToolId: input.observationToolId,
    });

    const doc = await TaskModel.create({
      organisationId: input.organisationId,
      appointmentId: input.appointmentId,

      companionId: input.companionId,

      createdBy: input.createdBy,
      assignedBy: input.assignedBy ?? input.createdBy,
      assignedTo: input.assignedTo,

      audience: input.audience,
      source: "YC_LIBRARY",
      libraryTaskId: input.libraryTaskId,
      templateId: undefined,

      category: input.categoryOverride ?? library.category,
      name: input.nameOverride ?? library.name,
      description: input.descriptionOverride ?? library.defaultDescription,

      medication: sanitizeMedication(input.medication),
      observationToolId: input.observationToolId,

      dueAt: input.dueAt,
      timezone: input.timezone,

      recurrence: buildRecurrence(input.recurrence),
      reminder: input.reminder
        ? {
            enabled: input.reminder.enabled,
            offsetMinutes: input.reminder.offsetMinutes,
            scheduledNotificationId: undefined,
          }
        : undefined,

      syncWithCalendar: input.syncWithCalendar ?? false,
      calendarEventId: undefined,

      attachments: input.attachments ?? [],

      status: "PENDING",
    });

    await syncTaskToPostgres(doc);

    void sendTaskAssignmentEmail(doc);

    return doc;
  },

  async createFromTemplate(
    input: CreateFromTemplateInput,
  ): Promise<TaskDocument> {
    const templateId = ensureObjectId(input.templateId, "templateId");
    const template = await TaskTemplateModel.findById(templateId).exec();

    if (!template || !template.isActive) {
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

    assertCompanionRequirement({
      audience,
      companionId: input.companionId,
      medication:
        input.medication ?? (template.defaultMedication as MedicationInput),
      observationToolId:
        input.observationToolId ?? template.defaultObservationToolId,
    });

    const recurrence =
      input.recurrence ||
      (template.defaultRecurrence
        ? {
            type: template.defaultRecurrence.type,
            endDate: template.defaultRecurrence.defaultEndOffsetDays
              ? new Date(
                  input.dueAt.getTime() +
                    template.defaultRecurrence.defaultEndOffsetDays *
                      24 *
                      60 *
                      60 *
                      1000,
                )
              : undefined,
            cronExpression: template.defaultRecurrence.customCron,
          }
        : undefined);

    const reminder =
      input.reminder ||
      (template.defaultReminderOffsetMinutes == null
        ? undefined
        : {
            enabled: true,
            offsetMinutes: template.defaultReminderOffsetMinutes,
          });

    const doc = await TaskModel.create({
      organisationId: input.organisationId,
      appointmentId: input.appointmentId,

      companionId: input.companionId,

      createdBy: input.createdBy,
      assignedBy: input.assignedBy ?? input.createdBy,
      assignedTo: input.assignedTo,

      audience,
      source: "ORG_TEMPLATE",
      libraryTaskId: template.libraryTaskId,
      templateId: template._id.toString(),

      category: input.categoryOverride ?? template.category,
      name: input.nameOverride ?? template.name,
      description: input.descriptionOverride ?? template.description,

      medication:
        sanitizeMedication(input.medication) ??
        sanitizeMedication(template.defaultMedication as MedicationInput),
      observationToolId:
        input.observationToolId ?? template.defaultObservationToolId,

      dueAt: input.dueAt,
      timezone: input.timezone,

      recurrence: buildRecurrence(recurrence),
      reminder: reminder
        ? {
            enabled: reminder.enabled,
            offsetMinutes: reminder.offsetMinutes,
            scheduledNotificationId: undefined,
          }
        : undefined,

      syncWithCalendar: input.syncWithCalendar ?? false,
      calendarEventId: undefined,

      attachments: input.attachments ?? [],

      status: "PENDING",
    });

    await syncTaskToPostgres(doc);

    void sendTaskAssignmentEmail(doc);

    return doc;
  },

  async createCustom(input: CreateCustomTaskInput): Promise<TaskDocument> {
    if (!input.category || !input.name) {
      throw new TaskServiceError("category and name are required", 400);
    }

    assertCompanionRequirement({
      audience: input.audience,
      companionId: input.companionId,
      medication: input.medication,
      observationToolId: input.observationToolId,
    });

    if (isReadFromPostgres()) {
      const reminder = input.reminder
        ? {
            enabled: input.reminder.enabled,
            offsetMinutes: input.reminder.offsetMinutes,
            scheduledNotificationId: undefined,
          }
        : undefined;

      const doc = await prisma.task.create({
        data: {
          organisationId: input.organisationId ?? undefined,
          appointmentId: input.appointmentId ?? undefined,
          companionId: input.companionId ?? undefined,
          createdBy: input.createdBy,
          assignedBy: input.assignedBy ?? input.createdBy,
          assignedTo: input.assignedTo,
          audience: input.audience as PrismaTaskAudience,
          source: "CUSTOM",
          category: input.category,
          name: input.name,
          description: input.description ?? undefined,
          additionalNotes: input.additionalNotes ?? undefined,
          medication: (sanitizeMedication(input.medication) ??
            undefined) as unknown as Prisma.InputJsonValue,
          observationToolId: input.observationToolId ?? undefined,
          dueAt: input.dueAt,
          timezone: input.timezone ?? undefined,
          recurrence: (buildRecurrence(input.recurrence) ??
            undefined) as unknown as Prisma.InputJsonValue,
          reminder: (reminder ?? undefined) as unknown as Prisma.InputJsonValue,
          syncWithCalendar: input.syncWithCalendar ?? false,
          calendarEventId: undefined,
          attachments: (input.attachments ??
            []) as unknown as Prisma.InputJsonValue,
          status: "PENDING",
        },
      });

      void sendTaskAssignmentEmail(doc as unknown as TaskDocument);
      return doc as unknown as TaskDocument;
    }

    const doc = await TaskModel.create({
      organisationId: input.organisationId,
      appointmentId: input.appointmentId,

      companionId: input.companionId,

      createdBy: input.createdBy,
      assignedBy: input.assignedBy ?? input.createdBy,
      assignedTo: input.assignedTo,

      audience: input.audience,
      source: "CUSTOM",
      libraryTaskId: undefined,
      templateId: undefined,

      category: input.category,
      name: input.name,
      description: input.description,
      additionalNotes: input.additionalNotes,

      medication: sanitizeMedication(input.medication),
      observationToolId: input.observationToolId,

      dueAt: input.dueAt,
      timezone: input.timezone,

      recurrence: buildRecurrence(input.recurrence),
      reminder: input.reminder
        ? {
            enabled: input.reminder.enabled,
            offsetMinutes: input.reminder.offsetMinutes,
            scheduledNotificationId: undefined,
          }
        : undefined,

      syncWithCalendar: input.syncWithCalendar ?? false,
      calendarEventId: undefined,

      attachments: input.attachments ?? [],

      status: "PENDING",
    });
    logger.info("Taske created -> ");
    await syncTaskToPostgres(doc);
    void sendTaskAssignmentEmail(doc);

    return doc;
  },

  async updateTask(
    taskId: string,
    updates: TaskUpdateInput,
    actorId: string,
  ): Promise<TaskDocument> {
    const task = await TaskModel.findById(taskId).exec();
    if (!task) throw new TaskServiceError("Task not found", 404);

    const isCreator = task.createdBy === actorId;
    const isAssignee = task.assignedTo === actorId;
    assertCanUpdateTask(isCreator, isAssignee);
    applyAssigneeUpdate(task, updates, isCreator);
    applyFieldUpdates(task, updates);
    applyRecurrenceUpdate(task, updates);

    await task.save();
    await syncTaskToPostgres(task);
    return task;
  },

  async changeStatus(
    taskId: string,
    newStatus: TaskStatus,
    actorId: string,
    completion?: CompleteTaskInput,
  ): Promise<{ task: TaskDocument; completion?: TaskCompletionDocument }> {
    if (isReadFromPostgres()) {
      const task = await prisma.task.findFirst({
        where: { id: taskId },
      });
      if (!task) throw new TaskServiceError("Task not found", 404);

      if (task.assignedTo !== actorId && task.createdBy !== actorId) {
        throw new TaskServiceError("Not allowed to update this task", 403);
      }

      if (task.status === "CANCELLED" || task.status === "COMPLETED") {
        throw new TaskServiceError("Task already finished", 400);
      }

      let nextStatus: PrismaTaskStatus = task.status;
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
        nextStatus = newStatus as PrismaTaskStatus;
      }

      let completionDoc: TaskCompletionDocument | undefined;

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
        completionDoc = created as unknown as TaskCompletionDocument;
      }

      const updated = await prisma.task.update({
        where: { id: task.id },
        data: {
          status: nextStatus,
          completedAt,
          completedBy,
        },
      });

      return {
        task: updated as unknown as TaskDocument,
        completion: completionDoc,
      };
    }

    const task = await TaskModel.findById(taskId).exec();
    if (!task) throw new TaskServiceError("Task not found", 404);

    if (task.assignedTo !== actorId && task.createdBy !== actorId) {
      throw new TaskServiceError("Not allowed to update this task", 403);
    }

    if (task.status === "CANCELLED" || task.status === "COMPLETED") {
      throw new TaskServiceError("Task already finished", 400);
    }

    if (newStatus === "IN_PROGRESS" && task.status === "PENDING") {
      task.status = "IN_PROGRESS";
    } else if (newStatus === "COMPLETED") {
      task.status = "COMPLETED";
      task.completedAt = new Date();
      task.completedBy = actorId;
    } else if (newStatus === "CANCELLED") {
      task.status = "CANCELLED";
    } else if (newStatus === "PENDING") {
      task.status = "PENDING";
    } else {
      task.status = newStatus;
    }

    let completionDoc: TaskCompletionDocument | undefined;

    if (newStatus === "COMPLETED" && completion?.answers) {
      completionDoc = await TaskCompletionModel.create({
        taskId: task._id.toString(),
        companionId: task.companionId,
        filledBy: completion.filledBy,
        answers: completion.answers,
        score: completion.score,
        summary: completion.summary,
      });
      await syncTaskCompletionToPostgres(completionDoc);
    }

    await task.save();
    await syncTaskToPostgres(task);
    return { task, completion: completionDoc };
  },

  async getById(taskId: string): Promise<TaskDocument | null> {
    if (isReadFromPostgres()) {
      const task = await prisma.task.findFirst({
        where: { id: taskId },
      });
      return (task ?? null) as unknown as TaskDocument | null;
    }
    return TaskModel.findById(taskId).exec();
  },

  async listForParent(params: {
    parentId: string;
    companionId?: string;
    fromDueAt?: Date;
    toDueAt?: Date;
    status?: TaskStatus[];
  }): Promise<TaskDocument[]> {
    const parentId = asNonEmptyString(params.parentId);
    if (!parentId) {
      throw new TaskServiceError("Invalid parentId");
    }

    if (isReadFromPostgres()) {
      const where: Prisma.TaskWhereInput = {
        audience: "PARENT_TASK",
        OR: [{ assignedTo: parentId }, { createdBy: parentId }],
      };

      const companionId = asNonEmptyString(params.companionId);
      if (companionId) where.companionId = companionId;

      const status = sanitizeStatusList(params.status);
      if (status) where.status = { in: status as PrismaTaskStatus[] };

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
      return tasks as unknown as TaskDocument[];
    }

    const filter: Record<string, unknown> = {
      audience: "PARENT_TASK",
      $or: [{ assignedTo: parentId }, { createdBy: parentId }],
    };

    const companionId = asNonEmptyString(params.companionId);
    if (companionId) filter.companionId = companionId;

    const status = sanitizeStatusList(params.status);
    if (status) filter.status = { $in: status };

    const fromDueAt = isValidDate(params.fromDueAt)
      ? params.fromDueAt
      : undefined;
    const toDueAt = isValidDate(params.toDueAt) ? params.toDueAt : undefined;
    if (fromDueAt || toDueAt) {
      const dueAtFilter: { $gte?: Date; $lte?: Date } = {};
      if (fromDueAt) dueAtFilter.$gte = fromDueAt;
      if (toDueAt) dueAtFilter.$lte = toDueAt;
      filter.dueAt = dueAtFilter;
    }

    return TaskModel.find(filter).sort({ dueAt: 1 }).exec();
  },

  async listForEmployee(params: {
    organisationId: string;
    userId?: string;
    companionId?: string;
    fromDueAt?: Date;
    toDueAt?: Date;
    status?: TaskStatus[];
  }): Promise<TaskDocument[]> {
    const organisationId = asNonEmptyString(params.organisationId);
    if (!organisationId) {
      throw new TaskServiceError("Invalid organisationId");
    }

    if (isReadFromPostgres()) {
      const where: Prisma.TaskWhereInput = {
        audience: "EMPLOYEE_TASK",
        organisationId,
      };

      const userId = asNonEmptyString(params.userId);
      if (userId) where.assignedTo = userId;

      const companionId = asNonEmptyString(params.companionId);
      if (companionId) where.companionId = companionId;

      const status = sanitizeStatusList(params.status);
      if (status) where.status = { in: status as PrismaTaskStatus[] };

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
      return tasks as unknown as TaskDocument[];
    }

    const filter: Record<string, unknown> = {
      audience: "EMPLOYEE_TASK",
      organisationId,
    };

    const userId = asNonEmptyString(params.userId);
    if (userId) filter.assignedTo = userId;

    const companionId = asNonEmptyString(params.companionId);
    if (companionId) filter.companionId = companionId;

    const status = sanitizeStatusList(params.status);
    if (status) filter.status = { $in: status };

    const fromDueAt = isValidDate(params.fromDueAt)
      ? params.fromDueAt
      : undefined;
    const toDueAt = isValidDate(params.toDueAt) ? params.toDueAt : undefined;
    if (fromDueAt || toDueAt) {
      const dueAtFilter: { $gte?: Date; $lte?: Date } = {};
      if (fromDueAt) dueAtFilter.$gte = fromDueAt;
      if (toDueAt) dueAtFilter.$lte = toDueAt;
      filter.dueAt = dueAtFilter;
    }

    return TaskModel.find(filter).sort({ dueAt: 1 }).exec();
  },

  async listForCompanion(params: {
    companionId: string;
    audience?: TaskAudience;
    fromDueAt?: Date;
    toDueAt?: Date;
    status?: TaskStatus[];
  }): Promise<TaskDocument[]> {
    const companionId = asNonEmptyString(params.companionId);
    if (!companionId) {
      throw new TaskServiceError("Invalid companionId");
    }

    if (isReadFromPostgres()) {
      const where: Prisma.TaskWhereInput = {
        companionId,
      };

      const audience = sanitizeAudience(params.audience);
      if (audience) where.audience = audience;

      const status = sanitizeStatusList(params.status);
      if (status) where.status = { in: status as PrismaTaskStatus[] };

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
      return tasks as unknown as TaskDocument[];
    }

    const filter: Record<string, unknown> = {
      companionId,
    };

    const audience = sanitizeAudience(params.audience);
    if (audience) filter.audience = audience;

    const status = sanitizeStatusList(params.status);
    if (status) filter.status = { $in: status };

    const fromDueAt = isValidDate(params.fromDueAt)
      ? params.fromDueAt
      : undefined;
    const toDueAt = isValidDate(params.toDueAt) ? params.toDueAt : undefined;
    if (fromDueAt || toDueAt) {
      const dueAtFilter: { $gte?: Date; $lte?: Date } = {};
      if (fromDueAt) dueAtFilter.$gte = fromDueAt;
      if (toDueAt) dueAtFilter.$lte = toDueAt;
      filter.dueAt = dueAtFilter;
    }

    return TaskModel.find(filter).sort({ dueAt: 1 }).exec();
  },

  async linkToAppointment(input: {
    taskId: string;
    appointmentId: string;
    enforceSingleTaskPerAppointment?: boolean;
  }): Promise<TaskDocument> {
    if (isReadFromPostgres()) {
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

      return updated as unknown as TaskDocument;
    }

    const task = await TaskModel.findById(input.taskId).exec();
    if (!task) {
      throw new TaskServiceError("Task not found", 404);
    }

    task.appointmentId = input.appointmentId;
    await task.save();
    await syncTaskToPostgres(task);

    return task;
  },
};
