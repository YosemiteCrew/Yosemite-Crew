import { Prisma, TaskTemplateRole } from "@prisma/client";
import { prisma } from "src/config/prisma";

export class TaskTemplateServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "TaskTemplateServiceError";
  }
}

export type TaskKind =
  | "MEDICATION"
  | "OBSERVATION_TOOL"
  | "HYGIENE"
  | "DIET"
  | "CUSTOM";

export type TaskTemplateDocument = Prisma.TaskTemplateGetPayload<
  Record<string, never>
>;

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

const resolveTaskKind = (input: {
  kind?: unknown;
  category?: unknown;
}): TaskKind | undefined =>
  sanitizeTaskKind(input.kind) ?? sanitizeTaskKind(input.category);

const ensureId = (value: string, field: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new TaskTemplateServiceError(`Invalid ${field}`, 400);
  }
  return trimmed;
};

const toJsonInput = (value: unknown) => value as Prisma.InputJsonValue;

export interface CreateTaskTemplateInput {
  organisationId: string;
  libraryTaskId?: string;

  category: string;
  name: string;
  description?: string;

  kind: TaskKind;
  defaultRole: "EMPLOYEE" | "PARENT";
  inpatientOnly?: boolean;

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
  inpatientOnly?: boolean;
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

const toDefaultRole = (value: "EMPLOYEE" | "PARENT") =>
  (value === "EMPLOYEE" ? "EMPLOYEE" : "PARENT") as TaskTemplateRole;

export const TaskTemplateService = {
  async create(input: CreateTaskTemplateInput): Promise<TaskTemplateDocument> {
    if (!input.organisationId || !input.category || !input.name) {
      throw new TaskTemplateServiceError(
        "organisationId, category and name are required",
        400,
      );
    }

    const doc = await prisma.taskTemplate.create({
      data: {
        source: "ORG_TEMPLATE",
        organisationId: ensureId(input.organisationId, "organisationId"),
        libraryTaskId: input.libraryTaskId ?? undefined,
        category: input.category,
        name: input.name,
        description: input.description ?? undefined,
        kind: (() => {
          const kind = resolveTaskKind(input);
          if (!kind) {
            throw new TaskTemplateServiceError("Invalid kind", 400);
          }
          return kind;
        })(),
        defaultRole: toDefaultRole(input.defaultRole),
        inpatientOnly: input.inpatientOnly ?? false,
        defaultMedication: toJsonInput(input.defaultMedication ?? undefined),
        defaultObservationToolId: input.defaultObservationToolId ?? undefined,
        defaultRecurrence: toJsonInput(input.defaultRecurrence ?? undefined),
        defaultReminderOffsetMinutes:
          input.defaultReminderOffsetMinutes ?? undefined,
        isActive: true,
        createdBy: input.createdBy,
      },
    });

    return doc;
  },

  async update(
    id: string,
    input: UpdateTaskTemplateInput,
  ): Promise<TaskTemplateDocument> {
    const safeId = ensureId(id, "id");
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
          input.description === undefined
            ? (existing.description ?? undefined)
            : (input.description ?? undefined),
        defaultRole:
          input.defaultRole === undefined
            ? existing.defaultRole
            : toDefaultRole(input.defaultRole),
        inpatientOnly:
          input.inpatientOnly === undefined
            ? existing.inpatientOnly
            : input.inpatientOnly,
        defaultMedication:
          input.defaultMedication === undefined
            ? (existing.defaultMedication ?? undefined)
            : toJsonInput(input.defaultMedication ?? undefined),
        defaultObservationToolId:
          input.defaultObservationToolId === undefined
            ? (existing.defaultObservationToolId ?? undefined)
            : (input.defaultObservationToolId ?? undefined),
        defaultRecurrence:
          input.defaultRecurrence === undefined
            ? (existing.defaultRecurrence ?? undefined)
            : toJsonInput(input.defaultRecurrence ?? undefined),
        defaultReminderOffsetMinutes:
          input.defaultReminderOffsetMinutes === undefined
            ? (existing.defaultReminderOffsetMinutes ?? undefined)
            : (input.defaultReminderOffsetMinutes ?? undefined),
        isActive: input.isActive ?? existing.isActive,
      },
    });

    return updated;
  },

  async archive(id: string): Promise<void> {
    const safeId = ensureId(id, "id");
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
  },

  async listForOrganisation(
    organisationId: string,
    kind?: TaskKind,
    options?: { inpatientOnly?: boolean; search?: string },
  ) {
    const safeOrganisationId = ensureId(organisationId, "organisationId");
    const safeKind = kind ? sanitizeTaskKind(kind) : undefined;
    if (kind && !safeKind) {
      throw new TaskTemplateServiceError("Invalid kind", 400);
    }
    const search = options?.search?.trim();

    const docs = await prisma.taskTemplate.findMany({
      where: {
        organisationId: safeOrganisationId,
        isActive: true,
        kind: safeKind,
        ...(options?.inpatientOnly === undefined
          ? {}
          : { inpatientOnly: options.inpatientOnly }),
        ...(search
          ? {
              OR: [
                {
                  category: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  description: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return docs;
  },

  async getById(id: string): Promise<TaskTemplateDocument> {
    const safeId = ensureId(id, "id");
    const doc = await prisma.taskTemplate.findFirst({
      where: { id: safeId },
    });
    if (!doc) {
      throw new TaskTemplateServiceError("Task template not found", 404);
    }
    return doc;
  },
};
