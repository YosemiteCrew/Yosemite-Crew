import { Prisma, TaskLibrarySpecies } from "@prisma/client";
import { prisma } from "src/config/prisma";

export class TaskLibraryServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "TaskLibraryServiceError";
  }
}

export type TaskKind =
  | "MEDICATION"
  | "OBSERVATION_TOOL"
  | "HYGIENE"
  | "DIET"
  | "CUSTOM";

export type Species = "dog" | "cat" | "horse";

export type TaskLibraryDefinitionDocument =
  Prisma.TaskLibraryDefinitionGetPayload<Record<string, never>>;

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

const ensureId = (value: string, field: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new TaskLibraryServiceError(`Invalid ${field}`, 400);
  }
  return trimmed;
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

const toJsonInput = (value: unknown) => value as Prisma.InputJsonValue;

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

    const existing = await prisma.taskLibraryDefinition.findFirst({
      where: {
        source: "YC_LIBRARY",
        name: safeName,
        kind,
      },
    });

    if (existing) {
      throw new TaskLibraryServiceError(
        "Task definition with same name and kind already exists",
        409,
      );
    }

    const doc = await prisma.taskLibraryDefinition.create({
      data: {
        source: "YC_LIBRARY",
        kind,
        category: input.category,
        name: safeName,
        defaultDescription: input.defaultDescription ?? undefined,
        applicableSpecies: (input.applicableSpecies ??
          []) as unknown as TaskLibrarySpecies[],
        schema: toJsonInput({
          medicationFields: input.schema.medicationFields ?? {},
          requiresObservationTool:
            input.schema.requiresObservationTool ?? false,
          recurrence: input.schema.recurrence,
        }),
        isActive: true,
      },
    });

    return doc;
  },

  async listActive(kind?: TaskKind): Promise<TaskLibraryDefinitionDocument[]> {
    const safeKind = kind ? sanitizeTaskKind(kind) : undefined;
    if (kind && !safeKind) {
      throw new TaskLibraryServiceError("Invalid kind", 400);
    }

    const docs = await prisma.taskLibraryDefinition.findMany({
      where: {
        isActive: true,
        kind: safeKind,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return docs;
  },

  async getById(id: string): Promise<TaskLibraryDefinitionDocument> {
    const safeId = ensureId(id, "id");
    const doc = await prisma.taskLibraryDefinition.findFirst({
      where: { id: safeId },
    });
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

    const safeKind = params.kind ? sanitizeTaskKind(params.kind) : undefined;
    if (params.kind && !safeKind) {
      throw new TaskLibraryServiceError("Invalid kind", 400);
    }

    const docs = await prisma.taskLibraryDefinition.findMany({
      where: {
        isActive: true,
        OR: [
          { applicableSpecies: { has: species as TaskLibrarySpecies } },
          { applicableSpecies: { isEmpty: true } },
        ],
        kind: safeKind,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return docs;
  },

  async update(
    id: string,
    input: UpdateTaskLibraryDefinitionInput,
  ): Promise<TaskLibraryDefinitionDocument> {
    const safeId = ensureId(id, "id");
    const existing = await prisma.taskLibraryDefinition.findFirst({
      where: { id: safeId },
    });
    if (!existing) {
      throw new TaskLibraryServiceError("Library task not found", 404);
    }

    const updated = await prisma.taskLibraryDefinition.update({
      where: { id: safeId },
      data: {
        category: input.category ?? existing.category,
        name:
          input.name === undefined
            ? existing.name
            : sanitizeTaskName(input.name),
        defaultDescription:
          input.defaultDescription === undefined
            ? (existing.defaultDescription ?? undefined)
            : (input.defaultDescription ?? undefined),
        applicableSpecies:
          input.applicableSpecies === undefined
            ? (existing.applicableSpecies ?? undefined)
            : ((input.applicableSpecies ??
                []) as unknown as TaskLibrarySpecies[]),
        schema:
          input.schema === undefined
            ? (existing.schema as Prisma.InputJsonValue)
            : toJsonInput({
                medicationFields: input.schema.medicationFields ?? {},
                requiresObservationTool:
                  input.schema.requiresObservationTool ?? false,
                recurrence: input.schema.recurrence ?? undefined,
              }),
        isActive: input.isActive ?? existing.isActive,
      },
    });

    return updated;
  },
};
