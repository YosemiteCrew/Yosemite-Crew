import {
  ObservationToolDefinitionModel,
  ObservationToolDefinitionDocument,
  OTField,
  OTFieldType,
} from "src/models/observationToolDefinition";

export class ObservationToolDefinitionServiceError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = "ObservationToolDefinitionServiceError";
  }
}

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
    if (!input.fields || !input.fields.length) {
      throw new ObservationToolDefinitionServiceError(
        "at least one field is required",
        400,
      );
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

    return doc;
  },

  async update(
    id: string,
    input: UpdateObservationToolDefinitionInput,
  ): Promise<ObservationToolDefinitionDocument> {
    const doc = await ObservationToolDefinitionModel.findById(id).exec();
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
    return doc;
  },

  async archive(id: string): Promise<void> {
    const doc = await ObservationToolDefinitionModel.findById(id).exec();
    if (!doc) {
      throw new ObservationToolDefinitionServiceError(
        "Observation tool not found",
        404,
      );
    }
    doc.isActive = false;
    await doc.save();
  },

  async list(params?: {
    category?: string;
    onlyActive?: boolean;
  }): Promise<ObservationToolDefinitionDocument[]> {
    const filter: Record<string, unknown> = {};
    if (params?.category) filter.category = params.category;
    if (params?.onlyActive) filter.isActive = true;

    return ObservationToolDefinitionModel.find(filter)
      .sort({ category: 1, name: 1 })
      .exec();
  },

  async getById(id: string): Promise<ObservationToolDefinitionDocument> {
    const doc = await ObservationToolDefinitionModel.findById(id).exec();
    if (!doc) {
      throw new ObservationToolDefinitionServiceError(
        "Observation tool not found",
        404,
      );
    }
    return doc;
  },
};
