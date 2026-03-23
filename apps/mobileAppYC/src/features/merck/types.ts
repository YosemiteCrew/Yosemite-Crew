export type MerckAudience = 'PAT';
export type MerckLanguage = 'en' | 'es';

export interface MerckSubLink {
  label: string;
  url: string;
}

export interface MerckEntry {
  id: string;
  title: string;
  summaryText: string;
  updatedAt: string | null;
  audience: MerckAudience;
  primaryUrl: string;
  subLinks: MerckSubLink[];
}

export interface MerckSearchRequest {
  organisationId: string;
  query: string;
  language?: MerckLanguage;
  media?: 'hybrid' | 'print' | 'full';
  audience?: MerckAudience;
}

export interface MerckSearchResponse {
  meta: {
    requestId?: string;
    source?: string;
    updatedAt?: string | null;
    audience: MerckAudience;
    language: MerckLanguage;
    totalResults: number;
  };
  entries: MerckEntry[];
}
