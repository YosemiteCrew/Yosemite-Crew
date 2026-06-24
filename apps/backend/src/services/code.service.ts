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
import { isReadFromPostgres } from "src/config/read-switch";

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
  if (!shouldDualWrite && !isReadFromPostgres()) return;
  try {
    const toJsonInput = (value: Record<string, unknown> | null | undefined) => {
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
          doc.synonyms === null ? Prisma.JsonNull : (doc.synonyms ?? undefined),
        meta: toJsonInput(doc.meta),
      },
      update: {
        display: doc.display,
        type: doc.type,
        active: doc.active,
        synonyms:
          doc.synonyms === null ? Prisma.JsonNull : (doc.synonyms ?? undefined),
        meta: toJsonInput(doc.meta),
      },
    });
  } catch (err) {
    handleDualWriteError("CodeEntry", err);
  }
};

const syncCodeMappingToPostgres = async (doc: CodeMappingDocument) => {
  if (!shouldDualWrite && !isReadFromPostgres()) return;
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

const toJsonInput = (value: Record<string, unknown> | null | undefined) => {
  if (value === null) return Prisma.JsonNull;
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
};

const normalizeTrimmedValue = <T extends string>(value?: T) =>
  typeof value === "string" && value.trim() ? value : undefined;

const normalizeLimit = (value?: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.floor(value)
    : undefined;

const escapeRegex = (value: string) =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\\$&`);

const applyEntryQueryFilter = (
  query: string | undefined,
  filter: Record<string, unknown>,
) => {
  if (!query) {
    return;
  }

  if (typeof query !== "string") {
    throw new CodeServiceError("Invalid query", 400);
  }

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return;
  }

  const escaped = escapeRegex(trimmedQuery);
  filter.$or = [
    { code: new RegExp(escaped, "i") },
    { display: new RegExp(escaped, "i") },
    { synonyms: new RegExp(escaped, "i") },
  ];
};

const applyEntryQueryWhere = (
  query: string | undefined,
  where: Prisma.CodeEntryWhereInput,
) => {
  if (!query) {
    return;
  }

  if (typeof query !== "string") {
    throw new CodeServiceError("Invalid query", 400);
  }

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return;
  }

  where.OR = [
    { code: { contains: trimmedQuery, mode: "insensitive" } },
    { display: { contains: trimmedQuery, mode: "insensitive" } },
  ];
};

const buildCodeMappingFilter = (params: {
  sourceSystem?: CodeSystem;
  sourceCode?: string;
  targetSystem?: CodeSystem;
  targetCode?: string;
  active?: boolean;
}) => {
  const filter: Record<string, unknown> = {};
  const safeSourceSystem = normalizeTrimmedValue(params.sourceSystem);
  const safeSourceCode = normalizeTrimmedValue(params.sourceCode);
  const safeTargetSystem = normalizeTrimmedValue(params.targetSystem);
  const safeTargetCode = normalizeTrimmedValue(params.targetCode);

  if (safeSourceSystem) filter.sourceSystem = safeSourceSystem;
  if (safeSourceCode) filter.sourceCode = safeSourceCode;
  if (safeTargetSystem) filter.targetSystem = safeTargetSystem;
  if (safeTargetCode) filter.targetCode = safeTargetCode;
  if (typeof params.active === "boolean") filter.active = params.active;

  return {
    filter,
    where: {
      sourceSystem: safeSourceSystem,
      sourceCode: safeSourceCode,
      targetSystem: safeTargetSystem,
      targetCode: safeTargetCode,
      active: params.active,
    },
  };
};

export const CodeService = {
  async upsertEntry(input: CodeEntryMongo) {
    ensureNonEmpty(input.system, "system");
    ensureNonEmpty(input.code, "code");
    ensureNonEmpty(input.display, "display");
    ensureNonEmpty(input.type, "type");

    if (isReadFromPostgres()) {
      const saved = await prisma.codeEntry.upsert({
        where: {
          system_code: {
            system: input.system,
            code: input.code,
          },
        },
        create: {
          system: input.system,
          code: input.code,
          display: input.display,
          type: input.type,
          active: input.active,
          synonyms:
            input.synonyms === null
              ? Prisma.JsonNull
              : (input.synonyms ?? undefined),
          meta: toJsonInput(input.meta),
        },
        update: {
          display: input.display,
          type: input.type,
          active: input.active,
          synonyms:
            input.synonyms === null
              ? Prisma.JsonNull
              : (input.synonyms ?? undefined),
          meta: toJsonInput(input.meta),
        },
      });

      return saved as unknown as CodeEntryDocument;
    }

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

    if (isReadFromPostgres()) {
      const saved = await prisma.codeMapping.upsert({
        where: {
          sourceSystem_sourceCode_targetSystem_targetCode: {
            sourceSystem: input.sourceSystem,
            sourceCode: input.sourceCode,
            targetSystem: input.targetSystem,
            targetCode: input.targetCode,
          },
        },
        create: {
          sourceSystem: input.sourceSystem,
          sourceCode: input.sourceCode,
          targetSystem: input.targetSystem,
          targetCode: input.targetCode,
          targetDisplay: input.targetDisplay ?? null,
          targetVersion: input.targetVersion ?? null,
          active: input.active,
        },
        update: {
          targetDisplay: input.targetDisplay ?? null,
          targetVersion: input.targetVersion ?? null,
          active: input.active,
        },
      });

      return saved as unknown as CodeMappingDocument;
    }

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
    const safeSystem = normalizeTrimmedValue(system);
    const safeType = normalizeTrimmedValue(type);
    const safeLimit = normalizeLimit(limit);

    if (safeSystem) filter.system = safeSystem;
    if (safeType) filter.type = safeType;
    if (typeof active === "boolean") filter.active = active;
    applyEntryQueryFilter(query, filter);

    if (isReadFromPostgres()) {
      const where: Prisma.CodeEntryWhereInput = {};
      if (safeSystem) where.system = safeSystem;
      if (safeType) where.type = safeType;
      if (typeof active === "boolean") where.active = active;
      applyEntryQueryWhere(query, where);

      return prisma.codeEntry.findMany({
        where,
        orderBy: { display: "asc" },
        take: safeLimit && safeLimit > 0 ? safeLimit : undefined,
      });
    }

    const cursor = CodeEntryModel.find(filter)
      .sort({ display: 1 })
      .setOptions({ sanitizeFilter: true });

    if (safeLimit && safeLimit > 0) {
      cursor.limit(safeLimit);
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
    const { filter, where } = buildCodeMappingFilter(params);

    if (isReadFromPostgres()) {
      return prisma.codeMapping.findMany({
        where: where as Prisma.CodeMappingWhereInput,
        orderBy: { createdAt: "desc" },
      });
    }

    return CodeMappingModel.find(filter)
      .sort({ createdAt: -1 })
      .setOptions({ sanitizeFilter: true })
      .lean();
  },
};
