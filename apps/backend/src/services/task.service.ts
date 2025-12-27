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
  const notes = typeof input.notes === "string" ? input.notes.trim() : undefined;

  // If everything is empty, store nothing
  if (!name && !type && !notes && (!doses || doses.length === 0)) return undefined;

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
}

export interface TaskUpdateInput {
  name?: string;
  description?: string;
  dueAt?: Date;
  timezone?: string | null;

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
  async createFromLibrary(input: CreateFromLibraryInput): Promise<TaskDocument> {
    const library = await TaskLibraryDefinitionModel.findById(
      input.libraryTaskId,
    ).exec();

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

    return doc;
  },

  async createFromTemplate(
    input: CreateFromTemplateInput,
  ): Promise<TaskDocument> {
    const template = await TaskTemplateModel.findById(input.templateId).exec();

    if (!template || !template.isActive) {
      throw new TaskServiceError("Task template not found or inactive", 404);
    }

    if (template.organisationId !== input.organisationId) {
      throw new TaskServiceError("Template does not belong to organisation", 400);
    }

    const audience: TaskAudience =
      input.audienceOverride ??
      (template.defaultRole === "PARENT" ? "PARENT_TASK" : "EMPLOYEE_TASK");


    assertCompanionRequirement({
      audience,
      companionId: input.companionId,
      medication: input.medication ?? (template.defaultMedication as MedicationInput),
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
        : { enabled: true, offsetMinutes: template.defaultReminderOffsetMinutes });

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

      medication: sanitizeMedication(input.medication) ?? sanitizeMedication(template.defaultMedication as MedicationInput),
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

    return doc;
  },

  async updateTask(
    taskId: string,
    updates: TaskUpdateInput,
    actorId: string,
  ): Promise<TaskDocument> {
    const task = await TaskModel.findById(taskId).exec();
    if (!task) throw new TaskServiceError("Task not found", 404);

    if (task.createdBy !== actorId && task.assignedTo !== actorId) {
      throw new TaskServiceError("Not allowed to update this task", 403);
    }

    if (updates.name !== undefined) task.name = updates.name;
    if (updates.description !== undefined) task.description = updates.description;
    if (updates.dueAt !== undefined) task.dueAt = updates.dueAt;

    if (updates.timezone !== undefined) task.timezone = updates.timezone ?? undefined;

    // ✅ medication now supports multiple doses
    if (updates.medication !== undefined) {
      if (updates.medication === null) {
        task.medication = undefined;
      } else {
        const next = sanitizeMedication(updates.medication);
        task.medication = next;
      }
    }

    if (updates.observationToolId !== undefined) {
      task.observationToolId = updates.observationToolId ?? undefined;
    }

    if (updates.reminder !== undefined) {
      if (updates.reminder === null) {
        task.reminder = undefined;
      } else {
        task.reminder = {
          enabled: updates.reminder.enabled,
          offsetMinutes: updates.reminder.offsetMinutes,
          scheduledNotificationId: task.reminder?.scheduledNotificationId,
        };
      }
    }

    if (updates.syncWithCalendar !== undefined) {
      task.syncWithCalendar = updates.syncWithCalendar;
    }

    if (updates.attachments !== undefined) {
      task.attachments = updates.attachments;
    }

    if (updates.recurrence !== undefined) {
      if (updates.recurrence === null) {
        task.recurrence = undefined;
      } else if (task.recurrence) {
          task.recurrence.type = updates.recurrence.type;
          task.recurrence.cronExpression =
            updates.recurrence.cronExpression ?? task.recurrence.cronExpression;
          task.recurrence.endDate =
            updates.recurrence.endDate ?? task.recurrence.endDate;
        } else {
          task.recurrence = {
            type: updates.recurrence.type,
            isMaster: true,
            masterTaskId: undefined,
            cronExpression: updates.recurrence.cronExpression ?? undefined,
            endDate: updates.recurrence.endDate ?? undefined,
          };
        }
    }

    await task.save();
    return task;
  },

  async changeStatus(
    taskId: string,
    newStatus: TaskStatus,
    actorId: string,
    completion?: CompleteTaskInput,
  ): Promise<{ task: TaskDocument; completion?: TaskCompletionDocument }> {
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
    }

    await task.save();
    return { task, completion: completionDoc };
  },

  async getById(taskId: string): Promise<TaskDocument | null> {
    return TaskModel.findById(taskId).exec();
  },

  async listForParent(params: {
    parentId: string;
    companionId?: string;
    fromDueAt?: Date;
    toDueAt?: Date;
    status?: TaskStatus[];
  }): Promise<TaskDocument[]> {
    const filter: Record<string, unknown> = {
      audience: "PARENT_TASK",
      assignedTo: params.parentId,
    };

    if (params.companionId) filter.companionId = params.companionId;
    if (params.status?.length) filter.status = { $in: params.status };

    if (params.fromDueAt || params.toDueAt) {
      const dueAtFilter: { $gte?: Date; $lte?: Date } = {};
      if (params.fromDueAt) dueAtFilter.$gte = params.fromDueAt;
      if (params.toDueAt) dueAtFilter.$lte = params.toDueAt;
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
    const filter: Record<string, unknown> = {
      audience: "EMPLOYEE_TASK",
      organisationId: params.organisationId,
    };

    if (params.userId) filter.assignedTo = params.userId;
    if (params.companionId) filter.companionId = params.companionId;
    if (params.status?.length) filter.status = { $in: params.status };

    if (params.fromDueAt || params.toDueAt) {
      const dueAtFilter: { $gte?: Date; $lte?: Date } = {};
      if (params.fromDueAt) dueAtFilter.$gte = params.fromDueAt;
      if (params.toDueAt) dueAtFilter.$lte = params.toDueAt;
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
    const filter: Record<string, unknown> = {
      companionId: params.companionId,
    };

    if (params.audience) filter.audience = params.audience;
    if (params.status?.length) filter.status = { $in: params.status };

    if (params.fromDueAt || params.toDueAt) {
      const dueAtFilter: { $gte?: Date; $lte?: Date } = {};
      if (params.fromDueAt) dueAtFilter.$gte = params.fromDueAt;
      if (params.toDueAt) dueAtFilter.$lte = params.toDueAt;
      filter.dueAt = dueAtFilter;
    }

    return TaskModel.find(filter).sort({ dueAt: 1 }).exec();
  },
};