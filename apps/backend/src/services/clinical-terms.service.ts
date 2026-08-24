import fs from "node:fs";
import path from "node:path";
import { type CodeEntryMongo, type CodeSystem } from "src/models/code-entry";
import { CodeService } from "src/services/code.service";
import { prisma } from "src/config/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export type ClinicalDomain =
  | "ReasonForVisit"
  | "PresentingComplaint"
  | "DiagnosticTest"
  | "Diagnosis"
  | "Procedure";

export type ClinicalSpecies =
  "SA" | "LA" | "FARM" | "EXOTICS" | "EQUINE" | "AVIAN";

const SUPPORTED_SPECIES = [
  "SA",
  "LA",
  "FARM",
  "EXOTICS",
  "EQUINE",
  "AVIAN",
] as const;

const SUPPORTED_DOMAINS = [
  "ReasonForVisit",
  "PresentingComplaint",
  "DiagnosticTest",
  "Diagnosis",
  "Procedure",
] as const;

const ClinicalCodeSchema = z.object({
  system: z.string().trim().min(1),
  code: z.string().trim().min(1),
  display: z.string().trim().optional(),
  equivalence: z
    .enum(["equivalent", "related", "narrower", "broader", "inexact"])
    .default("equivalent"),
});

const ClinicalDesignationSchema = z.object({
  term: z.string().trim().min(1),
  lang: z.string().trim().default("en"),
  source: z.enum(["venom", "snomed", "local"]).default("local"),
  preferred: z.boolean().default(false),
});

const ClinicalConceptSchema = z.object({
  ycCode: z.string().trim().min(1),
  label: z.string().trim().min(1),
  domain: z.enum(SUPPORTED_DOMAINS),
  active: z.boolean().default(true),
  source: z.enum(["VeNom", "SNOMED", "local"]),
  designations: z.array(ClinicalDesignationSchema).default([]),
  codes: z.array(ClinicalCodeSchema).default([]),
  species: z.array(z.enum(SUPPORTED_SPECIES)).default([]),
});

const ClinicalConceptListSchema = z.array(ClinicalConceptSchema);

export type ClinicalConcept = z.infer<typeof ClinicalConceptSchema>;

type ClinicalTermMeta = {
  domain?: ClinicalDomain;
  species?: ClinicalSpecies[];
  source?: ClinicalConcept["source"];
  preferredTerm?: string | null;
  designations?: ClinicalConcept["designations"];
  codes?: ClinicalConcept["codes"];
};

export type ClinicalTermSuggestion = {
  ycCode: string;
  label: string;
  domain?: ClinicalDomain;
  species: ClinicalSpecies[];
  synonyms: string[];
  source?: string;
};

const EXTERNAL_CODE_SYSTEM_MAP: Record<string, CodeSystem> = {
  "urn:venom": "VENOM",
  venom: "VENOM",
  "http://snomed.info/sct": "SNOMED",
  "https://snomed.info/sct": "SNOMED",
  snomed: "SNOMED",
};

const normalizeCodeSystem = (system: string): CodeSystem | null =>
  EXTERNAL_CODE_SYSTEM_MAP[system.trim().toLowerCase()] ?? null;

const toUniqueStrings = (values: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(trimmed);
  }

  return items;
};

const getPreferredDesignation = (concept: ClinicalConcept) =>
  concept.designations.find((designation) => designation.preferred)?.term ??
  null;

const buildEntryInput = (concept: ClinicalConcept): CodeEntryMongo => ({
  system: "YOSEMITECODE",
  code: concept.ycCode,
  display: concept.label,
  type: "CLINICAL_TERM",
  active: concept.active,
  synonyms: toUniqueStrings([
    concept.label,
    ...concept.designations.map((designation) => designation.term),
  ]),
  meta: {
    domain: concept.domain,
    species: concept.species,
    source: concept.source,
    preferredTerm: getPreferredDesignation(concept),
    designations: concept.designations,
    codes: concept.codes,
  } satisfies ClinicalTermMeta,
});

const normalizeMeta = (value: unknown): ClinicalTermMeta => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
};

const normalizeSynonyms = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
};

const toSuggestion = (entry: {
  code: string;
  display: string;
  synonyms?: unknown;
  meta?: unknown;
}): ClinicalTermSuggestion => {
  const meta = normalizeMeta(entry.meta);
  return {
    ycCode: entry.code,
    label: entry.display,
    domain: meta.domain,
    species: Array.isArray(meta.species)
      ? meta.species.filter((item): item is ClinicalSpecies =>
          SUPPORTED_SPECIES.includes(item),
        )
      : [],
    synonyms: toUniqueStrings(normalizeSynonyms(entry.synonyms)),
    source: typeof meta.source === "string" ? meta.source : undefined,
  };
};

type ClinicalTermRow = {
  code: string;
  display: string;
  synonyms: unknown;
  meta: unknown;
};

// A user typing % or _ means those characters literally, not as LIKE wildcards.
// Unescaped, a lone "%" would match the entire vocabulary.
const escapeLike = (value: string) =>
  value.replace(/[\\%_]/g, (character) => `\\${character}`);

const jsonTextArray = (expression: Prisma.Sql) =>
  Prisma.sql`jsonb_array_elements_text(CASE WHEN jsonb_typeof(${expression}) = 'array' THEN ${expression} ELSE '[]'::jsonb END)`;

const synonymMatches = (predicate: Prisma.Sql) =>
  Prisma.sql`EXISTS (SELECT 1 FROM ${jsonTextArray(Prisma.sql`e."synonyms"`)} s WHERE ${predicate})`;

export type SuggestTermsParams = {
  q?: string;
  domain?: ClinicalDomain;
  species?: ClinicalSpecies[];
  limit?: number;
};

/**
 * Built as a value so the pushdown itself is testable without a database. The
 * filtering used to happen in JavaScript over a fixed 5,000-row slice, which left
 * 6,742 of 11,742 terms permanently unsearchable.
 */
export const buildSuggestionQuery = (
  params: SuggestTermsParams,
): Prisma.Sql => {
  const safeLimit =
    typeof params.limit === "number" && Number.isFinite(params.limit)
      ? Math.min(Math.max(Math.floor(params.limit), 1), 50)
      : 10;
  const query = params.q?.trim().toLowerCase();
  // Hoisted so the patterns are built once rather than nested inside each SQL fragment.
  const escaped = query ? escapeLike(query) : "";
  const containsPattern = `%${escaped}%`;
  const prefixPattern = `${escaped}%`;

  // Filtering and scoring happen in SQL. Doing it in JavaScript meant first pulling a
  // fixed slice of rows, which silently made most of the vocabulary unsearchable.
  const filters: Prisma.Sql[] = [
    Prisma.sql`e."system" = 'YOSEMITECODE'::"CodeSystem"`,
    Prisma.sql`e."type" = 'CLINICAL_TERM'::"CodeType"`,
    Prisma.sql`e."active"`,
  ];

  if (query) {
    // Matches the indexed expression exactly so the trigram index is used. This is a
    // prefilter over a superset; scoreExpression below decides the real matches.
    filters.push(
      Prisma.sql`lower(e."display" || ' ' || COALESCE(e."synonyms"::text, '')) LIKE ${containsPattern} ESCAPE '\\'`,
    );
  }

  if (params.domain) {
    filters.push(Prisma.sql`e."meta"->>'domain' = ${params.domain}`);
  }

  if (params.species?.length) {
    filters.push(
      Prisma.sql`EXISTS (SELECT 1 FROM ${jsonTextArray(Prisma.sql`e."meta"->'species'`)} sp WHERE sp = ANY(${params.species}))`,
    );
  }

  const scoreExpression = query
    ? Prisma.sql`CASE
          WHEN lower(e."display") = ${query} THEN 400
          WHEN ${synonymMatches(Prisma.sql`lower(s) = ${query}`)} THEN 300
          WHEN lower(e."display") LIKE ${prefixPattern} ESCAPE '\\' THEN 200
          WHEN ${synonymMatches(Prisma.sql`lower(s) LIKE ${prefixPattern} ESCAPE '\\'`)} THEN 150
          WHEN lower(e."display") LIKE ${containsPattern} ESCAPE '\\' THEN 100
          WHEN ${synonymMatches(Prisma.sql`lower(s) LIKE ${containsPattern} ESCAPE '\\'`)} THEN 50
          ELSE 0
        END`
    : Prisma.sql`0`;

  return Prisma.sql`
    SELECT code, display, synonyms, meta, score FROM (
      SELECT e."code" AS code, e."display" AS display, e."synonyms" AS synonyms,
             e."meta" AS meta, ${scoreExpression} AS score
      FROM "CodeEntry" e
      WHERE ${Prisma.join(filters, " AND ")}
    ) scored
    WHERE ${query ? Prisma.sql`score > 0` : Prisma.sql`TRUE`}
    ORDER BY score DESC, display ASC
    LIMIT ${safeLimit}
  `;
};

export const ClinicalTermsService = {
  parseConcepts(raw: unknown) {
    return ClinicalConceptListSchema.parse(raw);
  },

  async importConcepts(concepts: ClinicalConcept[]) {
    let entriesUpserted = 0;
    let mappingsUpserted = 0;

    for (const concept of concepts) {
      await CodeService.upsertEntry(buildEntryInput(concept));
      entriesUpserted += 1;

      for (const code of concept.codes) {
        const targetSystem = normalizeCodeSystem(code.system);
        if (!targetSystem || code.equivalence !== "equivalent") continue;

        await CodeService.upsertMapping({
          sourceSystem: "YOSEMITECODE",
          sourceCode: concept.ycCode,
          targetSystem,
          targetCode: code.code,
          targetDisplay: code.display ?? concept.label,
          targetVersion: null,
          active: concept.active,
        });
        mappingsUpserted += 1;
      }
    }

    return { entriesUpserted, mappingsUpserted };
  },

  async importFromFile(filePath: string) {
    if (filePath.includes("..") || path.isAbsolute(filePath)) {
      throw new Error("Invalid file path");
    }
    const absolutePath = path.resolve(filePath);
    const rawText = fs.readFileSync(absolutePath, "utf-8");
    const parsed = this.parseConcepts(JSON.parse(rawText));
    return this.importConcepts(parsed);
  },

  async suggestTerms(params: SuggestTermsParams) {
    const rows = await prisma.$queryRaw<ClinicalTermRow[]>(
      buildSuggestionQuery(params),
    );
    return rows.map((row) => toSuggestion(row));
  },
};
