import type { Coding, Extension } from "@yosemite-crew/fhir";
import {
  parseSoapCodedProblems,
  SOAP_CODED_SECTIONS,
  SOAP_CODED_TERM_EXTENSION_URL,
  CONCEPT_MAP_EQUIVALENCE_EXTENSION_URL,
} from "@yosemite-crew/types";
import type { MappingEquivalence } from "src/models/code-mapping";
import {
  SYSTEM_URI,
  TerminologyProjectionService,
  USABLE_EQUIVALENCES,
  type ProjectionTarget,
} from "src/services/terminology-projection.service";

/** Our uppercase enum -> the FHIR ConceptMapEquivalence code it came from. */
const FHIR_EQUIVALENCE: Record<MappingEquivalence, string> = {
  RELATEDTO: "relatedto",
  EQUIVALENT: "equivalent",
  EQUAL: "equal",
  WIDER: "wider",
  SUBSUMES: "subsumes",
  NARROWER: "narrower",
  SPECIALIZES: "specializes",
  INEXACT: "inexact",
  UNMATCHED: "unmatched",
  DISJOINT: "disjoint",
};

const EXTERNAL_TARGETS: ProjectionTarget[] = ["VENOM", "SNOMED"];

/**
 * FHIR projection of a SOAP note's picked coded terms. Derived at read time and
 * never written back: the stored `diagnoses` channel remains exactly what the
 * clinician picked (record immutability), while every read serves translations
 * from the current mapping table. Only mappings with a usable ConceptMap
 * equivalence are emitted, and each external coding carries its equivalence
 * explicitly so a NARROWER or INEXACT crosswalk cannot read as an exact match.
 */
type ParsedProblems = ReturnType<typeof parseSoapCodedProblems>;

const codesIn = (parsed: NonNullable<ParsedProblems>): string[] =>
  SOAP_CODED_SECTIONS.flatMap((section) =>
    (parsed[section] ?? []).map((term) => term.ycCode),
  );

/** Usable translations per YC code, each coding carrying its explicit equivalence. */
const translationsFor = async (
  ycCodes: string[],
): Promise<Map<string, Coding[]>> => {
  const translations = new Map<string, Coding[]>();
  if (ycCodes.length === 0) return translations;
  const projections = await Promise.all(
    EXTERNAL_TARGETS.map((target) =>
      TerminologyProjectionService.projectCodes(ycCodes, target),
    ),
  );
  for (const list of projections) {
    for (const projected of list) {
      if (projected.status !== "mapped") continue;
      if (!USABLE_EQUIVALENCES.includes(projected.equivalence)) continue;
      const held = translations.get(projected.ycCode) ?? [];
      held.push({
        ...projected.coding,
        extension: [
          {
            url: CONCEPT_MAP_EQUIVALENCE_EXTENSION_URL,
            valueCode: FHIR_EQUIVALENCE[projected.equivalence],
          },
        ],
      });
      translations.set(projected.ycCode, held);
    }
  }
  return translations;
};

const extensionsFor = (
  parsed: NonNullable<ParsedProblems>,
  translations: Map<string, Coding[]>,
): Extension[] =>
  SOAP_CODED_SECTIONS.flatMap((section) =>
    (parsed[section] ?? []).map((term) => ({
      url: SOAP_CODED_TERM_EXTENSION_URL,
      extension: [
        { url: "section", valueString: section },
        {
          url: "concept",
          valueCodeableConcept: {
            text: term.label,
            coding: [
              // The Yosemite coding keeps the pick-time label deliberately:
              // a signed note must render what was recorded, not what the
              // vocabulary calls the concept today.
              {
                system: SYSTEM_URI.YOSEMITECODE,
                code: term.ycCode,
                display: term.label,
              },
              ...(translations.get(term.ycCode) ?? []),
            ],
          },
        },
      ],
    })),
  );

export const SoapCodedTermsFhirService = {
  /**
   * Batched form for bundles: one projection query set for the union of every
   * record's codes, with each record keeping only its own terms. Order and
   * length mirror the input, so entries pair up index-for-index.
   */
  async codedTermExtensionsForMany(
    diagnosesList: unknown[],
  ): Promise<Extension[][]> {
    const parsedList = diagnosesList.map(parseSoapCodedProblems);
    const ycCodes = [
      ...new Set(
        parsedList.flatMap((parsed) => (parsed ? codesIn(parsed) : [])),
      ),
    ];
    const translations = await translationsFor(ycCodes);
    return parsedList.map((parsed) =>
      parsed ? extensionsFor(parsed, translations) : [],
    );
  },

  async codedTermExtensions(diagnoses: unknown): Promise<Extension[]> {
    const [only] = await this.codedTermExtensionsForMany([diagnoses]);
    return only ?? [];
  },
};
