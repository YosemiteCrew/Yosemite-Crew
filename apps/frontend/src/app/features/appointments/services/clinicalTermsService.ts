import { getData } from '@/app/services/axios';

/** Domains the terminology suggest endpoint accepts (VeNom-style buckets). */
export type ClinicalTermDomain =
  'ReasonForVisit' | 'PresentingComplaint' | 'DiagnosticTest' | 'Diagnosis' | 'Procedure';

/** A crosswalk to another vocabulary, as the backend resolved it for this term. */
export type ClinicalTermCoding = {
  system: 'VENOM' | 'SNOMED' | 'IDEXX' | 'YOSEMITECODE';
  code: string;
  display?: string;
  equivalence: string;
};

export type ClinicalTermSuggestion = {
  ycCode: string;
  label: string;
  domain?: ClinicalTermDomain;
  species: string[];
  synonyms: string[];
  source?: string;
  /** VeNom/SNOMED equivalents, strongest per system; absent for unmapped terms. */
  codings?: ClinicalTermCoding[];
};

/**
 * Ranked term suggestions from the Yosemite clinical vocabulary
 * (`GET /v1/codes/terms/suggest`). Matches display text and multilingual
 * synonyms; `domain` narrows to one clinical bucket (e.g. Diagnosis for the
 * Assessment section) and is omitted to search everything.
 */
/** A practice can narrow the list to terms it can code in one vocabulary. */
export type VocabularyFilter = 'VENOM' | 'SNOMED';

/** Species buckets the vocabulary tags its terms with, as the endpoint accepts them. */
export type ClinicalTermSpecies = 'SA' | 'LA' | 'FARM' | 'EXOTICS' | 'EQUINE' | 'AVIAN';

/**
 * Companion species as recorded on the patient, mapped to the vocabulary's bucket.
 * Only the three the product records today are mapped; anything else resolves to
 * `undefined` and the caller sends no filter at all, because a wrong bucket hides
 * terms silently while no bucket only leaves the list as wide as it is now.
 *
 * A Map rather than an object literal: an object lookup also resolves inherited keys,
 * so a species recorded as `constructor` or `__proto__` - the two Object.prototype
 * members that survive the lower-casing below - would come back as an Object.prototype
 * member typed as ClinicalTermSpecies and go into the query string.
 */
const SPECIES_BY_COMPANION = new Map<string, ClinicalTermSpecies>([
  ['dog', 'SA'],
  ['cat', 'SA'],
  ['horse', 'EQUINE'],
]);

/**
 * The workspace carries the companion species as free text and has been seen
 * holding both `'dog'` and `'Dog'`, so the lookup is case- and space-insensitive.
 */
export const resolveClinicalTermSpecies = (
  companionSpecies?: string | null
): ClinicalTermSpecies | undefined =>
  SPECIES_BY_COMPANION.get(companionSpecies?.trim().toLowerCase() ?? '');

export const suggestClinicalTerms = async (params: {
  q: string;
  domain?: ClinicalTermDomain;
  species?: ClinicalTermSpecies;
  limit?: number;
  vocabulary?: VocabularyFilter;
}): Promise<ClinicalTermSuggestion[]> => {
  const search = new URLSearchParams({ q: params.q });
  if (params.domain) search.set('domain', params.domain);
  if (params.species) search.set('species', params.species);
  if (params.vocabulary) search.set('vocabulary', params.vocabulary);
  if (params.limit) search.set('limit', String(params.limit));
  const res = await getData<{ items?: ClinicalTermSuggestion[] }>(
    `/v1/codes/terms/suggest?${search.toString()}`
  );
  return res.data.items ?? [];
};

/** One ATCvet substance, with the classification levels above it for context. */
export type MedicationSuggestion = {
  atcCode: string;
  label: string;
  path: Array<{ code: string; label: string }>;
  species: string[];
  /** True for QJ01 systemic antibacterials — what stewardship reporting counts. */
  antibacterial: boolean;
};

/**
 * Ranked substances from the ATCvet classification
 * (`GET /v1/codes/medications/suggest`). Only substances are returned; the
 * grouping levels above them are never prescribable.
 */
export const suggestMedications = async (params: {
  q: string;
  group?: string;
  species?: string;
  limit?: number;
}): Promise<MedicationSuggestion[]> => {
  const search = new URLSearchParams({ q: params.q });
  if (params.group) search.set('group', params.group);
  if (params.species) search.set('species', params.species);
  if (params.limit) search.set('limit', String(params.limit));
  const res = await getData<{ items?: MedicationSuggestion[] }>(
    `/v1/codes/medications/suggest?${search.toString()}`
  );
  return res.data.items ?? [];
};
