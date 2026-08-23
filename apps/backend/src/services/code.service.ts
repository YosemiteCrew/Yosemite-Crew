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

/**
 * Hard ceiling on how many rows a single search may return, and on how many it
 * may examine to find them.
 *
 * `CodeEntry` is a terminology table (SNOMED / LOINC and friends), so a
 * text search that read every row before filtering turned one authenticated
 * request into a full-table load. Synonyms live in a JSON column and cannot be
 * matched in SQL, so the scan still happens in memory - it is simply bounded now.
 */
const MAX_CODE_SEARCH_RESULTS = 200;
const MAX_CODE_SEARCH_SCAN = 2_000;

const normalizeLimit = (value?: number) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const floored = Math.floor(value);
  if (floored <= 0) return undefined;
  return Math.min(floored, MAX_CODE_SEARCH_RESULTS);
};

const isStringArray = (
  value: Prisma.JsonValue | null | undefined,
): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const matchesEntryQuery = (
  entry: { code: string; display: string; synonyms?: Prisma.JsonValue | null },
  query: string,
) => {
  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery) {
    return true;
  }

  const values = [
    entry.code,
    entry.display,
    ...(isStringArray(entry.synonyms) ? entry.synonyms : []),
  ];

  return values.some((value) => value.toLowerCase().includes(trimmedQuery));
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

    if (query !== undefined && typeof query !== "string") {
      throw new CodeServiceError("Invalid query", 400);
    }

    if (!query?.trim()) {
      return prisma.codeEntry.findMany({
        where,
        orderBy: { display: "asc" },
        take: safeLimit ?? MAX_CODE_SEARCH_RESULTS,
      });
    }

    // Narrow in SQL on the two plain columns first, so the in-memory pass over
    // the JSON `synonyms` column runs over a bounded slice instead of the whole
    // table. Rows that only match on a synonym still surface: they are part of
    // the same bounded scan, just not part of the SQL predicate.
    const trimmedQuery = query.trim();
    const entries = await prisma.codeEntry.findMany({
      where: {
        ...where,
        OR: [
          { code: { contains: trimmedQuery, mode: "insensitive" } },
          { display: { contains: trimmedQuery, mode: "insensitive" } },
          { synonyms: { not: Prisma.JsonNull } },
        ],
      },
      orderBy: { display: "asc" },
      take: MAX_CODE_SEARCH_SCAN,
    });
    const filtered = entries.filter((entry) => matchesEntryQuery(entry, query));

    return filtered.slice(0, safeLimit ?? MAX_CODE_SEARCH_RESULTS);
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
      where: where,
      orderBy: { createdAt: "desc" },
    });
  },
};
