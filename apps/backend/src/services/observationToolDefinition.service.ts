import { Types } from "mongoose";
import {
  ObservationToolDefinitionModel,
  ObservationToolDefinitionDocument,
  OTField,
  OTFieldType,
} from "src/models/observationToolDefinition";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import { Prisma } from "@prisma/client";
import { isReadFromPostgres } from "src/config/read-switch";

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
  if (!isReadFromPostgres() && !Types.ObjectId.isValid(value)) {
    throw new ObservationToolDefinitionServiceError(`Invalid ${field}`, 400);
  }
  return value;
};

const toPrismaObservationToolDefinitionData = (
  doc: ObservationToolDefinitionDocument,
) => {
  const obj = doc.toObject() as {
    _id: { toString(): string };
    name: string;
    description?: string;
    category: string;
    fields: unknown[];
    scoringRules?: unknown;
    isActive?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  };

  return {
    id: obj._id.toString(),
    name: obj.name,
    description: obj.description ?? undefined,
    category: obj.category,
    fields: obj.fields as unknown as Prisma.InputJsonValue,
    scoringRules: (obj.scoringRules ??
      undefined) as unknown as Prisma.InputJsonValue,
    isActive: obj.isActive ?? true,
    createdAt: obj.createdAt ?? undefined,
    updatedAt: obj.updatedAt ?? undefined,
  };
};

const syncObservationToolDefinitionToPostgres = async (
  doc: ObservationToolDefinitionDocument,
) => {
  if (!shouldDualWrite) return;
  try {
    const data = toPrismaObservationToolDefinitionData(doc);
    await prisma.observationToolDefinition.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  } catch (err) {
    handleDualWriteError("ObservationToolDefinition", err);
  }
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

    if (isReadFromPostgres()) {
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
          })) as unknown as Prisma.InputJsonValue,
          scoringRules: (input.scoringRules ??
            undefined) as unknown as Prisma.InputJsonValue,
          isActive: true,
        },
      });
      return doc as unknown as ObservationToolDefinitionDocument;
    }

    const doc = await ObservationToolDefinitionModel.create({
      name: input.name,
      description: input.description,
      category: input.category,
      fields: input.fields.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        required: f.required ?? false,
        options: f.options,
        scoring: f.scoring,
      })),
      scoringRules: input.scoringRules,
      isActive: true,
    });

    await syncObservationToolDefinitionToPostgres(doc);

    return doc;
  },

  async update(
    id: string,
    input: UpdateObservationToolDefinitionInput,
  ): Promise<ObservationToolDefinitionDocument> {
    const safeId = ensureObjectId(id, "id");
    if (isReadFromPostgres()) {
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
            input.description !== undefined
              ? (input.description ?? undefined)
              : (existing.description ?? undefined),
          category: input.category ?? existing.category,
          fields:
            input.fields !== undefined
              ? (input.fields.map((f) => ({
                  key: f.key,
                  label: f.label,
                  type: f.type,
                  required: f.required ?? false,
                  options: f.options,
                  scoring: f.scoring,
                })) as unknown as Prisma.InputJsonValue)
              : (existing.fields as Prisma.InputJsonValue),
          scoringRules:
            input.scoringRules !== undefined
              ? ((input.scoringRules ??
                  undefined) as unknown as Prisma.InputJsonValue)
              : (existing.scoringRules ?? undefined),
          isActive: input.isActive ?? existing.isActive,
        },
      });

      return updated as unknown as ObservationToolDefinitionDocument;
    }

    const doc = await ObservationToolDefinitionModel.findById(safeId).exec();
    if (!doc) {
      throw new ObservationToolDefinitionServiceError(
        "Observation tool not found",
        404,
      );
    }

    if (input.name !== undefined) doc.name = input.name;
    if (input.description !== undefined) doc.description = input.description;
    if (input.category !== undefined) doc.category = input.category;
    if (input.fields !== undefined) {
      doc.fields = input.fields.map<OTField>((f) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        required: f.required ?? false,
        options: f.options,
        scoring: f.scoring,
      }));
    }
    if (input.scoringRules !== undefined) {
      doc.scoringRules = input.scoringRules;
    }
    if (input.isActive !== undefined) {
      doc.isActive = input.isActive;
    }

    await doc.save();
    await syncObservationToolDefinitionToPostgres(doc);
    return doc;
  },

  async archive(id: string): Promise<void> {
    const safeId = ensureObjectId(id, "id");
    if (isReadFromPostgres()) {
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
      return;
    }

    const doc = await ObservationToolDefinitionModel.findById(safeId).exec();
    if (!doc) {
      throw new ObservationToolDefinitionServiceError(
        "Observation tool not found",
        404,
      );
    }
    doc.isActive = false;
    await doc.save();
    await syncObservationToolDefinitionToPostgres(doc);
  },

  async list(params?: {
    category?: string;
    onlyActive?: boolean;
  }): Promise<ObservationToolDefinitionDocument[]> {
    const filter: Record<string, unknown> = {};
    if (params?.category !== undefined) {
      const category = asNonEmptyString(params.category);
      if (!category) {
        throw new ObservationToolDefinitionServiceError(
          "Invalid category",
          400,
        );
      }
      filter.category = category;
    }
    if (params?.onlyActive) filter.isActive = true;

    if (isReadFromPostgres()) {
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
    }

    return ObservationToolDefinitionModel.find(filter)
      .sort({ category: 1, name: 1 })
      .exec();
  },

  async getById(id: string): Promise<ObservationToolDefinitionDocument> {
    const safeId = ensureObjectId(id, "id");
    if (isReadFromPostgres()) {
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
    }

    const doc = await ObservationToolDefinitionModel.findById(safeId).exec();
    if (!doc) {
      throw new ObservationToolDefinitionServiceError(
        "Observation tool not found",
        404,
      );
    }
    return doc;
  },
};
