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
