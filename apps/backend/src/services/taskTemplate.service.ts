import { Types } from "mongoose";
import TaskTemplateModel, {
  TaskTemplateDocument,
} from "../models/taskTemplate";
import { TaskKind } from "../models/taskLibraryDefinition";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import {
  Prisma,
  TaskKind as PrismaTaskKind,
  TaskSource as PrismaTaskSource,
  TaskTemplateRole,
} from "@prisma/client";
import { isReadFromPostgres } from "src/config/read-switch";

export class TaskTemplateServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "TaskTemplateServiceError";
  }
}

const TASK_KINDS = new Set<TaskKind>([
  "MEDICATION",
  "OBSERVATION_TOOL",
  "HYGIENE",
  "DIET",
  "CUSTOM",
]);

const sanitizeTaskKind = (value: unknown): TaskKind | undefined =>
  typeof value === "string" && TASK_KINDS.has(value as TaskKind)
    ? (value as TaskKind)
    : undefined;

const ensureObjectId = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new TaskTemplateServiceError(`Invalid ${field}`, 400);
  }
  if (!isReadFromPostgres() && !Types.ObjectId.isValid(value)) {
    throw new TaskTemplateServiceError(`Invalid ${field}`, 400);
  }
  return value;
};

const toPrismaTaskTemplateData = (doc: TaskTemplateDocument) => {
  const obj = doc.toObject() as {
    _id: { toString(): string };
    source: string;
    organisationId: string;
    libraryTaskId?: string;
    category: string;
    name: string;
    description?: string;
    kind: string;
    defaultRole: string;
    defaultMedication?: unknown;
    defaultObservationToolId?: string;
    defaultRecurrence?: unknown;
    defaultReminderOffsetMinutes?: number;
    isActive?: boolean;
    createdBy: string;
    createdAt?: Date;
    updatedAt?: Date;
  };

  return {
    id: obj._id.toString(),
    source: obj.source as PrismaTaskSource,
    organisationId: obj.organisationId,
    libraryTaskId: obj.libraryTaskId ?? undefined,
    category: obj.category,
    name: obj.name,
    description: obj.description ?? undefined,
    kind: obj.kind as PrismaTaskKind,
    defaultRole: obj.defaultRole as TaskTemplateRole,
    defaultMedication: (obj.defaultMedication ??
      undefined) as unknown as Prisma.InputJsonValue,
    defaultObservationToolId: obj.defaultObservationToolId ?? undefined,
    defaultRecurrence: (obj.defaultRecurrence ??
      undefined) as unknown as Prisma.InputJsonValue,
    defaultReminderOffsetMinutes: obj.defaultReminderOffsetMinutes ?? undefined,
    isActive: obj.isActive ?? true,
    createdBy: obj.createdBy,
    createdAt: obj.createdAt ?? undefined,
    updatedAt: obj.updatedAt ?? undefined,
  };
};

const syncTaskTemplateToPostgres = async (doc: TaskTemplateDocument) => {
  if (!shouldDualWrite) return;
  try {
    const data = toPrismaTaskTemplateData(doc);
    await prisma.taskTemplate.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  } catch (err) {
    handleDualWriteError("TaskTemplate", err);
  }
};

export interface CreateTaskTemplateInput {
  organisationId: string;
  libraryTaskId?: string;

  category: string;
  name: string;
  description?: string;

  kind: TaskKind;
  defaultRole: "EMPLOYEE_TASK" | "PARENT_TASK";

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
    if (isReadFromPostgres()) {
      const doc = await prisma.taskTemplate.create({
        data: {
          source: "ORG_TEMPLATE",
          organisationId: input.organisationId,
          libraryTaskId: input.libraryTaskId ?? undefined,
          category: input.category,
          name: input.name,
          description: input.description ?? undefined,
          kind: input.kind as PrismaTaskKind,
          defaultRole: input.defaultRole as TaskTemplateRole,
          defaultMedication: (input.defaultMedication ??
            undefined) as unknown as Prisma.InputJsonValue,
          defaultObservationToolId: input.defaultObservationToolId ?? undefined,
          defaultRecurrence: (input.defaultRecurrence ??
            undefined) as unknown as Prisma.InputJsonValue,
          defaultReminderOffsetMinutes:
            input.defaultReminderOffsetMinutes ?? undefined,
          isActive: true,
          createdBy: input.createdBy,
        },
      });
      return doc as unknown as TaskTemplateDocument;
    }

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

    await syncTaskTemplateToPostgres(doc);

    return doc;
  },

  async update(
    id: string,
    input: UpdateTaskTemplateInput,
  ): Promise<TaskTemplateDocument> {
    const safeId = ensureObjectId(id, "id");
    if (isReadFromPostgres()) {
      const existing = await prisma.taskTemplate.findFirst({
        where: { id: safeId },
      });
      if (!existing) {
        throw new TaskTemplateServiceError("Task template not found", 404);
      }

      const updated = await prisma.taskTemplate.update({
        where: { id: safeId },
        data: {
          category: input.category ?? existing.category,
          name: input.name ?? existing.name,
          description:
            input.description !== undefined
              ? (input.description ?? undefined)
              : (existing.description ?? undefined),
          defaultRole:
            input.defaultRole !== undefined
              ? ((input.defaultRole === "EMPLOYEE"
                  ? "EMPLOYEE_TASK"
                  : "PARENT_TASK") as TaskTemplateRole)
              : existing.defaultRole,
          defaultMedication:
            input.defaultMedication !== undefined
              ? ((input.defaultMedication ??
                  undefined) as unknown as Prisma.InputJsonValue)
              : (existing.defaultMedication ?? undefined),
          defaultObservationToolId:
            input.defaultObservationToolId !== undefined
              ? (input.defaultObservationToolId ?? undefined)
              : (existing.defaultObservationToolId ?? undefined),
          defaultRecurrence:
            input.defaultRecurrence !== undefined
              ? ((input.defaultRecurrence ??
                  undefined) as unknown as Prisma.InputJsonValue)
              : (existing.defaultRecurrence ?? undefined),
          defaultReminderOffsetMinutes:
            input.defaultReminderOffsetMinutes !== undefined
              ? (input.defaultReminderOffsetMinutes ?? undefined)
              : (existing.defaultReminderOffsetMinutes ?? undefined),
          isActive: input.isActive ?? existing.isActive,
        },
      });

      return updated as unknown as TaskTemplateDocument;
    }

    const doc = await TaskTemplateModel.findById(safeId).exec();
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
    await syncTaskTemplateToPostgres(doc);
    return doc;
  },

  async archive(id: string): Promise<void> {
    const safeId = ensureObjectId(id, "id");
    if (isReadFromPostgres()) {
      const existing = await prisma.taskTemplate.findFirst({
        where: { id: safeId },
      });
      if (!existing) {
        throw new TaskTemplateServiceError("Task template not found", 404);
      }
      await prisma.taskTemplate.update({
        where: { id: safeId },
        data: { isActive: false },
      });
      return;
    }

    const doc = await TaskTemplateModel.findById(safeId).exec();
    if (!doc)
      throw new TaskTemplateServiceError("Task template not found", 404);
    doc.isActive = false;
    await doc.save();
    await syncTaskTemplateToPostgres(doc);
  },

  async listForOrganisation(organisationId: string, kind?: TaskKind) {
    const safeOrganisationId = ensureObjectId(organisationId, "organisationId");
    const filter: Record<string, unknown> = {
      organisationId: safeOrganisationId,
      isActive: true,
    };
    if (kind) {
      const safeKind = sanitizeTaskKind(kind);
      if (!safeKind) {
        throw new TaskTemplateServiceError("Invalid kind", 400);
      }
      filter.kind = safeKind;
    }

    if (isReadFromPostgres()) {
      const where: Prisma.TaskTemplateWhereInput = {
        organisationId: safeOrganisationId,
        isActive: true,
      };
      if (kind) {
        const safeKind = sanitizeTaskKind(kind);
        if (!safeKind) {
          throw new TaskTemplateServiceError("Invalid kind", 400);
        }
        where.kind = safeKind as PrismaTaskKind;
      }

      const docs = await prisma.taskTemplate.findMany({
        where,
        orderBy: [{ category: "asc" }, { name: "asc" }],
      });
      return docs as unknown as TaskTemplateDocument[];
    }

    return TaskTemplateModel.find(filter).sort({ category: 1, name: 1 }).exec();
  },

  async getById(id: string): Promise<TaskTemplateDocument> {
    const safeId = ensureObjectId(id, "id");
    if (isReadFromPostgres()) {
      const doc = await prisma.taskTemplate.findFirst({
        where: { id: safeId },
      });
      if (!doc)
        throw new TaskTemplateServiceError("Task template not found", 404);
      return doc as unknown as TaskTemplateDocument;
    }

    const doc = await TaskTemplateModel.findById(safeId).exec();
    if (!doc)
      throw new TaskTemplateServiceError("Task template not found", 404);
    return doc;
  },
};
