import TaskLibraryDefinitionModel, {
  TaskLibraryDefinitionDocument,
  TaskKind,
  Species,
} from "../models/taskLibraryDefinition";

export class TaskLibraryServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "TaskLibraryServiceError";
  }
}

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

    validateSchemaByKind(input.kind, input.schema);

    const existing = await TaskLibraryDefinitionModel.findOne({
      source: "YC_LIBRARY",
      name: input.name,
      kind: input.kind,
    }).lean();

    if (existing) {
      throw new TaskLibraryServiceError(
        "Task definition with same name and kind already exists",
        409,
      );
    }

    return TaskLibraryDefinitionModel.create({
      source: "YC_LIBRARY",
      kind: input.kind,
      category: input.category,
      name: input.name,
      defaultDescription: input.defaultDescription,
      applicableSpecies: input.applicableSpecies,
      schema: {
        medicationFields: input.schema.medicationFields ?? {},
        requiresObservationTool: input.schema.requiresObservationTool ?? false,
        recurrence: input.schema.recurrence,
      },
      isActive: true,
    });
  },

  async listActive(kind?: TaskKind): Promise<TaskLibraryDefinitionDocument[]> {
    const filter: Record<string, unknown> = { isActive: true };
    if (kind) {
      filter.kind = kind;
    }

    return TaskLibraryDefinitionModel.find(filter)
      .sort({ category: 1, name: 1 })
      .exec();
  },

  async getById(id: string): Promise<TaskLibraryDefinitionDocument> {
    const doc = await TaskLibraryDefinitionModel.findById(id).exec();
    if (!doc) {
      throw new TaskLibraryServiceError("Library task not found", 404);
    }
    return doc;
  },

  async listForSpecies(params: {
    species: string;
    kind?: TaskKind;
  }): Promise<TaskLibraryDefinitionDocument[]> {
    const filter: Record<string, unknown> = {
      isActive: true,
      $or: [
        { applicableSpecies: params.species }, // species-specific
        { applicableSpecies: { $exists: false } }, // universal tasks
      ],
    };

    if (params.kind) {
      filter.kind = params.kind;
    }

    return TaskLibraryDefinitionModel.find(filter)
      .sort({ category: 1, name: 1 })
      .exec();
  },

  async update(
    id: string,
    input: UpdateTaskLibraryDefinitionInput,
  ): Promise<TaskLibraryDefinitionDocument> {
    const doc = await TaskLibraryDefinitionModel.findById(id).exec();
    if (!doc) {
      throw new TaskLibraryServiceError("Library task not found", 404);
    }

    if (input.category !== undefined) doc.category = input.category;
    if (input.name !== undefined) doc.name = input.name;
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
    return doc;
  },
};
