import CodeEntryModel, {
  type CodeEntryDocument,
  type CodeEntryMongo,
  type CodeSystem,
  type CodeType,
} from "src/models/code-entry";
import CodeMappingModel, {
  type CodeMappingDocument,
  type CodeMappingMongo,
} from "src/models/code-mapping";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import { Prisma } from "@prisma/client";

export class CodeServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "CodeServiceError";
  }
}

const syncCodeEntryToPostgres = async (doc: CodeEntryDocument) => {
  if (!shouldDualWrite) return;
  try {
    const toJsonInput = (
      value: Record<string, unknown> | null | undefined,
    ) => {
      if (value === null) return Prisma.JsonNull;
      if (value === undefined) return undefined;
      return value as Prisma.InputJsonValue;
    };

    await prisma.codeEntry.upsert({
      where: {
        system_code: {
          system: doc.system,
          code: doc.code,
        },
      },
      create: {
        system: doc.system,
        code: doc.code,
        display: doc.display,
        type: doc.type,
        active: doc.active,
        synonyms:
          doc.synonyms === null
            ? Prisma.JsonNull
            : (doc.synonyms ?? undefined),
        meta: toJsonInput(doc.meta),
      },
      update: {
        display: doc.display,
        type: doc.type,
        active: doc.active,
        synonyms:
          doc.synonyms === null
            ? Prisma.JsonNull
            : (doc.synonyms ?? undefined),
        meta: toJsonInput(doc.meta),
      },
    });
  } catch (err) {
    handleDualWriteError("CodeEntry", err);
  }
};

const syncCodeMappingToPostgres = async (doc: CodeMappingDocument) => {
  if (!shouldDualWrite) return;
  try {
    await prisma.codeMapping.upsert({
      where: {
        sourceSystem_sourceCode_targetSystem_targetCode: {
          sourceSystem: doc.sourceSystem,
          sourceCode: doc.sourceCode,
          targetSystem: doc.targetSystem,
          targetCode: doc.targetCode,
        },
      },
      create: {
        sourceSystem: doc.sourceSystem,
        sourceCode: doc.sourceCode,
        targetSystem: doc.targetSystem,
        targetCode: doc.targetCode,
        targetDisplay: doc.targetDisplay ?? null,
        targetVersion: doc.targetVersion ?? null,
        active: doc.active,
      },
      update: {
        targetDisplay: doc.targetDisplay ?? null,
        targetVersion: doc.targetVersion ?? null,
        active: doc.active,
      },
    });
  } catch (err) {
    handleDualWriteError("CodeMapping", err);
  }
};

const ensureNonEmpty = (value: string | undefined, field: string) => {
  if (!value?.trim()) {
    throw new CodeServiceError(`${field} is required.`, 400);
  }
};

export const CodeService = {
  async upsertEntry(input: CodeEntryMongo) {
    ensureNonEmpty(input.system, "system");
    ensureNonEmpty(input.code, "code");
    ensureNonEmpty(input.display, "display");
    ensureNonEmpty(input.type, "type");

    const saved = await CodeEntryModel.findOneAndUpdate(
      { system: input.system, code: input.code },
      { $set: input },
      { upsert: true, new: true, sanitizeFilter: true },
    );

    if (saved) {
      await syncCodeEntryToPostgres(saved);
    }

    return saved;
  },

  async upsertMapping(input: CodeMappingMongo) {
    ensureNonEmpty(input.sourceSystem, "sourceSystem");
    ensureNonEmpty(input.sourceCode, "sourceCode");
    ensureNonEmpty(input.targetSystem, "targetSystem");
    ensureNonEmpty(input.targetCode, "targetCode");

    const saved = await CodeMappingModel.findOneAndUpdate(
      {
        sourceSystem: input.sourceSystem,
        sourceCode: input.sourceCode,
        targetSystem: input.targetSystem,
        targetCode: input.targetCode,
      },
      { $set: input },
      { upsert: true, new: true, sanitizeFilter: true },
    );

    if (saved) {
      await syncCodeMappingToPostgres(saved);
    }

    return saved;
  },

  async listEntries(params: {
    system?: CodeSystem;
    type?: CodeType;
    active?: boolean;
    query?: string;
    limit?: number;
  }) {
    const { system, type, active, query, limit } = params;
    const filter: Record<string, unknown> = {};

    if (system) filter.system = system;
    if (type) filter.type = type;
    if (typeof active === "boolean") filter.active = active;

    if (query) {
      filter.$or = [
        { code: new RegExp(query, "i") },
        { display: new RegExp(query, "i") },
        { synonyms: new RegExp(query, "i") },
      ];
    }

    const cursor = CodeEntryModel.find(filter).sort({ display: 1 });

    if (limit && limit > 0) {
      cursor.limit(limit);
    }

    return cursor.lean();
  },

  async listMappings(params: {
    sourceSystem?: CodeSystem;
    sourceCode?: string;
    targetSystem?: CodeSystem;
    targetCode?: string;
    active?: boolean;
  }) {
    const { sourceSystem, sourceCode, targetSystem, targetCode, active } =
      params;
    const filter: Record<string, unknown> = {};

    if (sourceSystem) filter.sourceSystem = sourceSystem;
    if (sourceCode) filter.sourceCode = sourceCode;
    if (targetSystem) filter.targetSystem = targetSystem;
    if (targetCode) filter.targetCode = targetCode;
    if (typeof active === "boolean") filter.active = active;

    return CodeMappingModel.find(filter).sort({ createdAt: -1 }).lean();
  },
};
