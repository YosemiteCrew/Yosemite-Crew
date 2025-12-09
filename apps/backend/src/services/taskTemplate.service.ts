import TaskTemplateModel, {
  TaskTemplateDocument,
} from "../models/taskTemplate";
import { TaskKind } from "../models/taskLibraryDefinition";

export class TaskTemplateServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "TaskTemplateServiceError";
  }
}

export interface CreateTaskTemplateInput {
  organisationId: string;
  libraryTaskId?: string;

  category: string;
  name: string;
  description?: string;

  kind: TaskKind;
  defaultRole: "EMPLOYEE" | "PARENT";

  defaultMedication?: {
    name?: string;
    type?: string;
    dosage?: string;
    frequency?: string;
  };

  defaultObservationToolId?: string;

  defaultRecurrence?: {
    type: "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";
    customCron?: string;
    defaultEndOffsetDays?: number;
  };

  defaultReminderOffsetMinutes?: number;

  createdBy: string;
}

export interface UpdateTaskTemplateInput {
  category?: string;
  name?: string;
  description?: string;
  defaultRole?: "EMPLOYEE" | "PARENT";
  defaultMedication?: {
    name?: string;
    type?: string;
    dosage?: string;
    frequency?: string;
  } | null;
  defaultObservationToolId?: string | null;
  defaultRecurrence?: {
    type: "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";
    customCron?: string;
    defaultEndOffsetDays?: number;
  } | null;
  defaultReminderOffsetMinutes?: number | null;
  isActive?: boolean;
}

export const TaskTemplateService = {
  async create(input: CreateTaskTemplateInput): Promise<TaskTemplateDocument> {
    const doc = await TaskTemplateModel.create({
      source: "ORG_TEMPLATE",
      organisationId: input.organisationId,
      libraryTaskId: input.libraryTaskId,

      category: input.category,
      name: input.name,
      description: input.description,

      kind: input.kind,
      defaultRole: input.defaultRole,

      defaultMedication: input.defaultMedication ?? {},
      defaultObservationToolId: input.defaultObservationToolId,

      defaultRecurrence: input.defaultRecurrence,
      defaultReminderOffsetMinutes: input.defaultReminderOffsetMinutes,

      isActive: true,
      createdBy: input.createdBy,
    });

    return doc;
  },

  async update(
    id: string,
    input: UpdateTaskTemplateInput,
  ): Promise<TaskTemplateDocument> {
    const doc = await TaskTemplateModel.findById(id).exec();
    if (!doc) {
      throw new TaskTemplateServiceError("Task template not found", 404);
    }

    if (input.category !== undefined) doc.category = input.category;
    if (input.name !== undefined) doc.name = input.name;
    if (input.description !== undefined) doc.description = input.description;
    if (input.defaultRole !== undefined) doc.defaultRole = input.defaultRole;

    if (input.defaultMedication !== undefined) {
      doc.defaultMedication = input.defaultMedication ?? {};
    }

    if (input.defaultObservationToolId !== undefined) {
      doc.defaultObservationToolId =
        input.defaultObservationToolId ?? undefined;
    }

    if (input.defaultRecurrence !== undefined) {
      doc.defaultRecurrence = input.defaultRecurrence ?? undefined;
    }

    if (input.defaultReminderOffsetMinutes !== undefined) {
      doc.defaultReminderOffsetMinutes =
        input.defaultReminderOffsetMinutes ?? undefined;
    }

    if (input.isActive !== undefined) {
      doc.isActive = input.isActive;
    }

    await doc.save();
    return doc;
  },

  async archive(id: string): Promise<void> {
    const doc = await TaskTemplateModel.findById(id).exec();
    if (!doc)
      throw new TaskTemplateServiceError("Task template not found", 404);
    doc.isActive = false;
    await doc.save();
  },

  async listForOrganisation(organisationId: string, kind?: TaskKind) {
    const filter: Record<string, unknown> = {
      organisationId,
      isActive: true,
    };
    if (kind) filter.kind = kind;

    return TaskTemplateModel.find(filter).sort({ category: 1, name: 1 }).exec();
  },

  async getById(id: string): Promise<TaskTemplateDocument> {
    const doc = await TaskTemplateModel.findById(id).exec();
    if (!doc)
      throw new TaskTemplateServiceError("Task template not found", 404);
    return doc;
  },
};
