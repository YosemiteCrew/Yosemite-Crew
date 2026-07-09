import {
  type CodeEntryDocument,
  type CodeEntryMongo,
  type CodeSystem,
  type CodeType,
} from "src/models/code-entry";
import {
  type CodeMappingDocument,
  type CodeMappingMongo,
} from "src/models/code-mapping";
import { prisma } from "src/config/prisma";
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

const syncCodeEntryToPostgres = async (input: CodeEntryMongo) => {
  const toJsonInput = (value: Record<string, unknown> | null | undefined) => {
    if (value === null) return Prisma.JsonNull;
    if (value === undefined) return undefined;
    return value as Prisma.InputJsonValue;
  };

  return prisma.codeEntry.upsert({
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
};

const syncCodeMappingToPostgres = async (input: CodeMappingMongo) => {
  return prisma.codeMapping.upsert({
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
};

const ensureNonEmpty = (value: string | undefined, field: string) => {
  if (!value?.trim()) {
    throw new CodeServiceError(`${field} is required.`, 400);
  }
};

const normalizeTrimmedValue = <T extends string>(value?: T) =>
  typeof value === "string" && value.trim() ? value : undefined;

const normalizeLimit = (value?: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.floor(value)
    : undefined;

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
  const safeSourceSystem = normalizeTrimmedValue(params.sourceSystem);
  const safeSourceCode = normalizeTrimmedValue(params.sourceCode);
  const safeTargetSystem = normalizeTrimmedValue(params.targetSystem);
  const safeTargetCode = normalizeTrimmedValue(params.targetCode);

  return {
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

    const saved = await syncCodeEntryToPostgres(input);

    return saved as unknown as CodeEntryDocument;
  },

  async upsertMapping(input: CodeMappingMongo) {
    ensureNonEmpty(input.sourceSystem, "sourceSystem");
    ensureNonEmpty(input.sourceCode, "sourceCode");
    ensureNonEmpty(input.targetSystem, "targetSystem");
    ensureNonEmpty(input.targetCode, "targetCode");

    const saved = await syncCodeMappingToPostgres(input);

    return saved as unknown as CodeMappingDocument;
  },

  async listEntries(params: {
    system?: CodeSystem;
    type?: CodeType;
    active?: boolean;
    query?: string;
    limit?: number;
  }) {
    const { system, type, active, query, limit } = params;
    const safeSystem = normalizeTrimmedValue(system);
    const safeType = normalizeTrimmedValue(type);
    const safeLimit = normalizeLimit(limit);

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
  },

  async listMappings(params: {
    sourceSystem?: CodeSystem;
    sourceCode?: string;
    targetSystem?: CodeSystem;
    targetCode?: string;
    active?: boolean;
  }) {
    const { where } = buildCodeMappingFilter(params);

    return prisma.codeMapping.findMany({
      where: where as Prisma.CodeMappingWhereInput,
      orderBy: { createdAt: "desc" },
    });
  },
};
