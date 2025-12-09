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

export interface BaseTaskCreateInput {
  organisationId?: string;
  appointmentId?: string;

  companionId: string;

  createdBy: string;
  assignedBy?: string;
  assignedTo: string;

  dueAt: Date;
  timezone?: string;

  // optional functional bits
  medication?: {
    name?: string;
    type?: string;
    dosage?: string;
    frequency?: string;
  };

  observationToolId?: string;

  recurrence?: {
    type: RecurrenceType;
    endDate?: Date;
    cronExpression?: string; // optional for CUSTOM
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
  // optional overrides
  categoryOverride?: string;
  nameOverride?: string;
  descriptionOverride?: string;
}

export interface CreateFromTemplateInput extends BaseTaskCreateInput {
  templateId: string;
  // optional overrides
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

  medication?: {
    name?: string;
    type?: string;
    dosage?: string;
    frequency?: string;
  } | null;

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

  // limited recurrence update (no changing master/id)
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
  // ──────────────────────────────────────────────
  // CREATE: From YC Library
  // ──────────────────────────────────────────────
  async createFromLibrary(
    input: CreateFromLibraryInput,
  ): Promise<TaskDocument> {
    const library = await TaskLibraryDefinitionModel.findById(
      input.libraryTaskId,
    ).exec();

    if (!library || !library.isActive) {
      throw new TaskServiceError("Library task not found or inactive", 404);
    }

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

      medication: input.medication,
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

  // ──────────────────────────────────────────────
  // CREATE: From Org Template
  // ──────────────────────────────────────────────
  async createFromTemplate(
    input: CreateFromTemplateInput,
  ): Promise<TaskDocument> {
    const template = await TaskTemplateModel.findById(input.templateId).exec();

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
      (template.defaultReminderOffsetMinutes != null
        ? {
            enabled: true,
            offsetMinutes: template.defaultReminderOffsetMinutes,
          }
        : undefined);

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

      medication: input.medication ?? template.defaultMedication,
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

  // ──────────────────────────────────────────────
  // CREATE: Custom Task
  // ──────────────────────────────────────────────
  async createCustom(input: CreateCustomTaskInput): Promise<TaskDocument> {
    if (!input.category || !input.name) {
      throw new TaskServiceError("category and name are required", 400);
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

      medication: input.medication,
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

  // ──────────────────────────────────────────────
  // UPDATE (partial)
  // ──────────────────────────────────────────────
  async updateTask(
    taskId: string,
    updates: TaskUpdateInput,
    actorId: string,
  ): Promise<TaskDocument> {
    const task = await TaskModel.findById(taskId).exec();
    if (!task) {
      throw new TaskServiceError("Task not found", 404);
    }

    // simple rule: creator or assignedTo can edit
    if (task.createdBy !== actorId && task.assignedTo !== actorId) {
      throw new TaskServiceError("Not allowed to update this task", 403);
    }

    if (updates.name !== undefined) task.name = updates.name;
    if (updates.description !== undefined)
      task.description = updates.description;
    if (updates.dueAt !== undefined) task.dueAt = updates.dueAt;

    if (updates.timezone !== undefined) {
      task.timezone = updates.timezone ?? undefined;
    }

    if (updates.medication !== undefined) {
      if (updates.medication === null) {
        task.medication = undefined;
      } else {
        task.medication = { ...task.medication, ...updates.medication };
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
      } else {
        // we don't touch masterTaskId/isMaster here
        if (!task.recurrence) {
          task.recurrence = {
            type: updates.recurrence.type,
            isMaster: true,
            masterTaskId: undefined,
            cronExpression: updates.recurrence.cronExpression ?? undefined,
            endDate: updates.recurrence.endDate ?? undefined,
          };
        } else {
          task.recurrence.type = updates.recurrence.type;
          task.recurrence.cronExpression =
            updates.recurrence.cronExpression ?? task.recurrence.cronExpression;
          task.recurrence.endDate =
            updates.recurrence.endDate ?? task.recurrence.endDate;
        }
      }
    }

    await task.save();
    return task;
  },

  // ──────────────────────────────────────────────
  // STATUS + COMPLETION
  // ──────────────────────────────────────────────
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

    // simple allowed transitions
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

    if (newStatus === "COMPLETED" && completion && completion.answers) {
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

  // ──────────────────────────────────────────────
  // FETCH / LIST
  // ──────────────────────────────────────────────
  async getById(taskId: string): Promise<TaskDocument | null> {
    return TaskModel.findById(taskId).exec();
  },

  async listForParent(params: {
    parentId: string; // the parent userId
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
