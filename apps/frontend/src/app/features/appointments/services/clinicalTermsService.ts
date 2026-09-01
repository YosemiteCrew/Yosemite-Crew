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
export const suggestClinicalTerms = async (params: {
  q: string;
  domain?: ClinicalTermDomain;
  limit?: number;
}): Promise<ClinicalTermSuggestion[]> => {
  const search = new URLSearchParams({ q: params.q });
  if (params.domain) search.set('domain', params.domain);
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
