import fs from "node:fs";
import path from "node:path";
import { type CodeEntryMongo, type CodeSystem } from "src/models/code-entry";
import { type MappingEquivalence } from "src/models/code-mapping";
import { CodeService } from "src/services/code.service";
import { prisma } from "src/config/prisma";
import { z } from "zod";

// A queried autocomplete scans a large but bounded slice of active clinical
// terms so synonym-only matches on later alphabetic rows are not dropped, while
// still capping the rows pulled into memory. Sized to comfortably exceed the
// curated clinical terminology; browsing (no query) stays bounded by fetchLimit.
const CLINICAL_TERM_QUERY_SCAN_LIMIT = 5000;

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

/**
 * The extract uses its own wording for equivalence; this is the FHIR ConceptMap
 * vocabulary. Anything unrecognised becomes INEXACT rather than EQUIVALENT: overstating
 * how well a crosswalk holds is the failure that silently corrupts a research cohort.
 */
const EQUIVALENCE_MAP: Record<string, MappingEquivalence> = {
  equivalent: "EQUIVALENT",
  related: "RELATEDTO",
  narrower: "NARROWER",
  broader: "WIDER",
  inexact: "INEXACT",
};

const toMappingEquivalence = (value?: string): MappingEquivalence =>
  EQUIVALENCE_MAP[(value ?? "").trim().toLowerCase()] ?? "INEXACT";

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

const scoreSuggestion = (term: ClinicalTermSuggestion, query?: string) => {
  if (!query) return 0;
  const normalized = query.trim().toLowerCase();
  const label = term.label.toLowerCase();
  const synonyms = term.synonyms.map((item) => item.toLowerCase());

  if (label === normalized) return 400;
  if (synonyms.includes(normalized)) return 300;
  if (label.startsWith(normalized)) return 200;
  if (synonyms.some((item) => item.startsWith(normalized))) return 150;
  if (label.includes(normalized)) return 100;
  if (synonyms.some((item) => item.includes(normalized))) return 50;
  return 0;
};

const matchesSpecies = (
  termSpecies: ClinicalSpecies[],
  requestedSpecies?: ClinicalSpecies[],
) => {
  if (!requestedSpecies?.length) return true;
  if (!termSpecies.length) return false;
  return requestedSpecies.some((species) => termSpecies.includes(species));
};

const matchesQuery = (term: ClinicalTermSuggestion, query?: string) => {
  if (!query?.trim()) return true;
  return scoreSuggestion(term, query) > 0;
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
        if (!targetSystem) continue;

        await CodeService.upsertMapping({
          sourceSystem: "YOSEMITECODE",
          sourceCode: concept.ycCode,
          targetSystem,
          targetCode: code.code,
          targetDisplay: code.display ?? concept.label,
          targetVersion: null,
          equivalence: toMappingEquivalence(code.equivalence),
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

  async suggestTerms(params: {
    q?: string;
    domain?: ClinicalDomain;
    species?: ClinicalSpecies[];
    limit?: number;
  }) {
    const safeLimit =
      typeof params.limit === "number" && Number.isFinite(params.limit)
        ? Math.min(Math.max(Math.floor(params.limit), 1), 50)
        : 10;
    const query = params.q?.trim();
    const fetchLimit = Math.max(safeLimit * 10, 50);

    const rows = await prisma.codeEntry.findMany({
      where: {
        system: "YOSEMITECODE",
        type: "CLINICAL_TERM",
        active: true,
      },
      orderBy: { display: "asc" },
      take: query ? CLINICAL_TERM_QUERY_SCAN_LIMIT : fetchLimit,
    });

    const candidates = rows.map((row) => toSuggestion(row));

    return candidates
      .filter((term) => !params.domain || term.domain === params.domain)
      .filter((term) => matchesSpecies(term.species, params.species))
      .filter((term) => matchesQuery(term, query))
      .sort((left, right) => {
        const scoreDelta =
          scoreSuggestion(right, query) - scoreSuggestion(left, query);
        if (scoreDelta !== 0) return scoreDelta;
        return left.label.localeCompare(right.label);
      })
      .slice(0, safeLimit);
  },
};
