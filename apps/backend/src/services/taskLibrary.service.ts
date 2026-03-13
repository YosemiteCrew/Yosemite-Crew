import { Types } from "mongoose";
import TaskLibraryDefinitionModel, {
  TaskLibraryDefinitionDocument,
  TaskKind,
  Species,
} from "../models/taskLibraryDefinition";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import {
  Prisma,
  TaskKind as PrismaTaskKind,
  TaskLibrarySpecies,
  TaskSource as PrismaTaskSource,
} from "@prisma/client";

export class TaskLibraryServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "TaskLibraryServiceError";
  }
}

const TASK_KINDS = new Set<TaskKind>([
  "MEDICATION",
  "OBSERVATION_TOOL",
  "HYGIENE",
  "DIET",
  "CUSTOM",
]);
const SPECIES_LIST = new Set<Species>(["dog", "cat", "horse"]);

const sanitizeTaskKind = (value: unknown): TaskKind | undefined =>
  typeof value === "string" && TASK_KINDS.has(value as TaskKind)
    ? (value as TaskKind)
    : undefined;

const sanitizeSpecies = (value: unknown): Species | undefined =>
  typeof value === "string" && SPECIES_LIST.has(value as Species)
    ? (value as Species)
    : undefined;

const sanitizeTaskName = (value: unknown, field = "name"): string => {
  if (typeof value !== "string") {
    throw new TaskLibraryServiceError(`Invalid ${field}`, 400);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new TaskLibraryServiceError(`Invalid ${field}`, 400);
  }

  if (/[.$]/.test(trimmed)) {
    throw new TaskLibraryServiceError(
      `${field} contains invalid characters`,
      400,
    );
  }

  return trimmed;
};

const ensureObjectId = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !Types.ObjectId.isValid(value)) {
    throw new TaskLibraryServiceError(`Invalid ${field}`, 400);
  }
  return value;
};

const toPrismaTaskLibraryDefinitionData = (
  doc: TaskLibraryDefinitionDocument,
) => {
  const obj = doc.toObject() as {
    _id: { toString(): string };
    source: string;
    kind: string;
    category: string;
    name: string;
    defaultDescription?: string;
    schema: unknown;
    applicableSpecies?: string[];
    isActive?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  };

  return {
    id: obj._id.toString(),
    source: obj.source as PrismaTaskSource,
    kind: obj.kind as PrismaTaskKind,
    category: obj.category,
    name: obj.name,
    defaultDescription: obj.defaultDescription ?? undefined,
    schema: obj.schema as Prisma.InputJsonValue,
    applicableSpecies: (obj.applicableSpecies ??
      []) as unknown as TaskLibrarySpecies[],
    isActive: obj.isActive ?? true,
    createdAt: obj.createdAt ?? undefined,
    updatedAt: obj.updatedAt ?? undefined,
  };
};

const syncTaskLibraryDefinitionToPostgres = async (
  doc: TaskLibraryDefinitionDocument,
) => {
  if (!shouldDualWrite) return;
  try {
    const data = toPrismaTaskLibraryDefinitionData(doc);
    await prisma.taskLibraryDefinition.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  } catch (err) {
    handleDualWriteError("TaskLibraryDefinition", err);
  }
};

export interface CreateTaskLibraryDefinitionInput {
  kind: TaskKind;
  category: string;
  name: string;
  defaultDescription?: string;

  applicableSpecies?: Species[];

  schema: {
    medicationFields?: {
      hasMedicationName?: boolean;
      hasType?: boolean;
      hasDosage?: boolean;
      hasFrequency?: boolean;
    };
    requiresObservationTool?: boolean;
    recurrence?: {
      default?: {
        type: "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";
        cronExpression?: string;
        editable?: boolean;
        endAfterDays?: number;
      };
    };
  };
}

export interface UpdateTaskLibraryDefinitionInput {
  category?: string;
  name?: string;
  defaultDescription?: string;
  applicableSpecies?: Species[] | null;
  schema?: CreateTaskLibraryDefinitionInput["schema"];
  isActive?: boolean;
}

const validateSchemaByKind = (
  kind: TaskKind,
  schema: CreateTaskLibraryDefinitionInput["schema"],
) => {
  if (kind === "MEDICATION" && !schema.medicationFields) {
    throw new TaskLibraryServiceError(
      "medicationFields required for MEDICATION task",
      400,
    );
  }

  if (kind === "OBSERVATION_TOOL" && !schema.requiresObservationTool) {
    throw new TaskLibraryServiceError(
      "requiresObservationTool must be true for OBSERVATION_TOOL task",
      400,
    );
  }

  if (
    schema.recurrence?.default?.type === "CUSTOM" &&
    !schema.recurrence.default.cronExpression
  ) {
    throw new TaskLibraryServiceError(
      "cronExpression required for CUSTOM recurrence",
      400,
    );
  }
};

export const TaskLibraryService = {
  async create(
    input: CreateTaskLibraryDefinitionInput,
  ): Promise<TaskLibraryDefinitionDocument> {
    if (!input.kind || !input.category || !input.name) {
      throw new TaskLibraryServiceError(
        "kind, category and name are required",
        400,
      );
    }

    const kind = sanitizeTaskKind(input.kind);
    if (!kind) {
      throw new TaskLibraryServiceError("Invalid kind", 400);
    }

    validateSchemaByKind(kind, input.schema);

    const safeName = sanitizeTaskName(input.name);

    const existing = await TaskLibraryDefinitionModel.findOne({
      source: "YC_LIBRARY",
      name: safeName,
      kind,
    }).lean();

    if (existing) {
      throw new TaskLibraryServiceError(
        "Task definition with same name and kind already exists",
        409,
      );
    }

    const doc = await TaskLibraryDefinitionModel.create({
      source: "YC_LIBRARY",
      kind,
      category: input.category,
      name: safeName,
      defaultDescription: input.defaultDescription,
      applicableSpecies: input.applicableSpecies,
      schema: {
        medicationFields: input.schema.medicationFields ?? {},
        requiresObservationTool: input.schema.requiresObservationTool ?? false,
        recurrence: input.schema.recurrence,
      },
      isActive: true,
    });
    await syncTaskLibraryDefinitionToPostgres(doc);
    return doc;
  },

  async listActive(kind?: TaskKind): Promise<TaskLibraryDefinitionDocument[]> {
    const filter: Record<string, unknown> = { isActive: true };
    if (kind) {
      const safeKind = sanitizeTaskKind(kind);
      if (!safeKind) {
        throw new TaskLibraryServiceError("Invalid kind", 400);
      }
      filter.kind = safeKind;
    }

    return TaskLibraryDefinitionModel.find(filter)
      .sort({ category: 1, name: 1 })
      .exec();
  },

  async getById(id: string): Promise<TaskLibraryDefinitionDocument> {
    const safeId = ensureObjectId(id, "id");
    const doc = await TaskLibraryDefinitionModel.findById(safeId).exec();
    if (!doc) {
      throw new TaskLibraryServiceError("Library task not found", 404);
    }
    return doc;
  },

  async listForSpecies(params: {
    species: string;
    kind?: TaskKind;
  }): Promise<TaskLibraryDefinitionDocument[]> {
    const species = sanitizeSpecies(params.species);
    if (!species) {
      throw new TaskLibraryServiceError("Invalid species", 400);
    }

    const filter: Record<string, unknown> = {
      isActive: true,
      $or: [
        { applicableSpecies: species }, // species-specific
        { applicableSpecies: { $exists: false } }, // universal tasks
      ],
    };

    if (params.kind) {
      const safeKind = sanitizeTaskKind(params.kind);
      if (!safeKind) {
        throw new TaskLibraryServiceError("Invalid kind", 400);
      }
      filter.kind = safeKind;
    }

    return TaskLibraryDefinitionModel.find(filter)
      .sort({ category: 1, name: 1 })
      .exec();
  },

  async update(
    id: string,
    input: UpdateTaskLibraryDefinitionInput,
  ): Promise<TaskLibraryDefinitionDocument> {
    const safeId = ensureObjectId(id, "id");
    const doc = await TaskLibraryDefinitionModel.findById(safeId).exec();
    if (!doc) {
      throw new TaskLibraryServiceError("Library task not found", 404);
    }

    if (input.category !== undefined) doc.category = input.category;
    if (input.name !== undefined) doc.name = sanitizeTaskName(input.name);
    if (input.defaultDescription !== undefined) {
      doc.defaultDescription = input.defaultDescription;
    }

    if (input.applicableSpecies !== undefined) {
      doc.applicableSpecies = input.applicableSpecies ?? undefined;
    }

    if (input.schema !== undefined) {
      const nextSchema = {
        medicationFields: input.schema.medicationFields ?? {},
        requiresObservationTool: input.schema.requiresObservationTool ?? false,
        recurrence: input.schema.recurrence ?? undefined,
      };

      doc.set("schema", nextSchema);
      doc.markModified("schema");
    }

    if (input.isActive !== undefined) {
      doc.isActive = input.isActive;
    }

    await doc.save();
    await syncTaskLibraryDefinitionToPostgres(doc);
    return doc;
  },
};
