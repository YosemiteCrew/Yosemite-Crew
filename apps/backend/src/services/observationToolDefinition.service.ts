import {
  ObservationToolDefinitionDocument,
  OTFieldType,
} from "src/models/observationToolDefinition";
import { prisma } from "src/config/prisma";
import { Prisma } from "@prisma/client";

export class ObservationToolDefinitionServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "ObservationToolDefinitionServiceError";
  }
}

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const ensureObjectId = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new ObservationToolDefinitionServiceError(`Invalid ${field}`, 400);
  }
  return value;
};

export interface CreateObservationToolDefinitionInput {
  name: string;
  description?: string;
  category: string;
  fields: {
    key: string;
    label: string;
    type: OTFieldType;
    required?: boolean;
    options?: string[];
    scoring?: {
      points?: number;
      map?: Record<string, number>;
    };
  }[];
  scoringRules?: {
    sumFields?: string[];
    customFormula?: string; // not used yet, reserved
  };
}

export interface UpdateObservationToolDefinitionInput {
  name?: string;
  description?: string;
  category?: string;
  fields?: CreateObservationToolDefinitionInput["fields"];
  scoringRules?: CreateObservationToolDefinitionInput["scoringRules"];
  isActive?: boolean;
}

export const ObservationToolDefinitionService = {
  async create(
    input: CreateObservationToolDefinitionInput,
  ): Promise<ObservationToolDefinitionDocument> {
    if (!input.name) {
      throw new ObservationToolDefinitionServiceError("name is required", 400);
    }
    if (!input.category) {
      throw new ObservationToolDefinitionServiceError(
        "category is required",
        400,
      );
    }
    if (!input.fields?.length) {
      throw new ObservationToolDefinitionServiceError(
        "at least one field is required",
        400,
      );
    }

    const doc = await prisma.observationToolDefinition.create({
      data: {
        name: input.name,
        description: input.description ?? undefined,
        category: input.category,
        fields: input.fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.required ?? false,
          options: f.options,
          scoring: f.scoring,
        })),
        scoringRules: (input.scoringRules ??
          undefined) as unknown as Prisma.InputJsonValue,
        isActive: true,
      },
    });
    return doc as unknown as ObservationToolDefinitionDocument;
  },

  async update(
    id: string,
    input: UpdateObservationToolDefinitionInput,
  ): Promise<ObservationToolDefinitionDocument> {
    const safeId = ensureObjectId(id, "id");
    const existing = await prisma.observationToolDefinition.findFirst({
      where: { id: safeId },
    });
    if (!existing) {
      throw new ObservationToolDefinitionServiceError(
        "Observation tool not found",
        404,
      );
    }

    const updated = await prisma.observationToolDefinition.update({
      where: { id: safeId },
      data: {
        name: input.name ?? existing.name,
        description:
          input.description === undefined
            ? (existing.description ?? undefined)
            : (input.description ?? undefined),
        category: input.category ?? existing.category,
        fields:
          input.fields === undefined
            ? (existing.fields as Prisma.InputJsonValue)
            : (input.fields.map((f) => ({
                key: f.key,
                label: f.label,
                type: f.type,
                required: f.required ?? false,
                options: f.options,
                scoring: f.scoring,
              })) as unknown as Prisma.InputJsonValue),
        scoringRules:
          input.scoringRules === undefined
            ? (existing.scoringRules ?? undefined)
            : ((input.scoringRules ??
                undefined) as unknown as Prisma.InputJsonValue),
        isActive: input.isActive ?? existing.isActive,
      },
    });

    return updated as unknown as ObservationToolDefinitionDocument;
  },

  async archive(id: string): Promise<void> {
    const safeId = ensureObjectId(id, "id");
    const existing = await prisma.observationToolDefinition.findFirst({
      where: { id: safeId },
    });
    if (!existing) {
      throw new ObservationToolDefinitionServiceError(
        "Observation tool not found",
        404,
      );
    }
    await prisma.observationToolDefinition.update({
      where: { id: safeId },
      data: { isActive: false },
    });
  },

  async list(params?: {
    category?: string;
    onlyActive?: boolean;
  }): Promise<ObservationToolDefinitionDocument[]> {
    const where: { category?: string; isActive?: boolean } = {};
    if (params?.category !== undefined) {
      const category = asNonEmptyString(params.category);
      if (!category) {
        throw new ObservationToolDefinitionServiceError(
          "Invalid category",
          400,
        );
      }
      where.category = category;
    }
    if (params?.onlyActive) {
      where.isActive = true;
    }
    const docs = await prisma.observationToolDefinition.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return docs as unknown as ObservationToolDefinitionDocument[];
  },

  async getById(id: string): Promise<ObservationToolDefinitionDocument> {
    const safeId = ensureObjectId(id, "id");
    const doc = await prisma.observationToolDefinition.findFirst({
      where: { id: safeId },
    });
    if (!doc) {
      throw new ObservationToolDefinitionServiceError(
        "Observation tool not found",
        404,
      );
    }
    return doc as unknown as ObservationToolDefinitionDocument;
  },
};
