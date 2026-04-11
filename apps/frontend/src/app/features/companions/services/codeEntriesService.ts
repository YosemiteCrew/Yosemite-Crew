import { getData } from "@/app/services/axios";

const CODE_SYSTEM = "YOSEMITECODE";

export interface SpeciesCodeEntry {
  code: string;
  display: string;
}

export interface BreedCodeEntry {
  code: string;
  display: string;
  meta?: {
    species?: string;
    speciesCode?: string;
  };
}

export const fetchSpeciesCodeEntries = async (): Promise<SpeciesCodeEntry[]> => {
  const response = await getData<SpeciesCodeEntry[]>("/v1/codes/entries", {
    system: CODE_SYSTEM,
    type: "SPECIES",
  });
  return Array.isArray(response.data) ? response.data : [];
};

export const fetchBreedCodeEntries = async (
  speciesQuery: string,
): Promise<BreedCodeEntry[]> => {
  const response = await getData<BreedCodeEntry[]>("/v1/codes/entries", {
    system: CODE_SYSTEM,
    type: "BREED",
    q: speciesQuery,
  });
  return Array.isArray(response.data) ? response.data : [];
};
