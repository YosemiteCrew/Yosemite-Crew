import { getData } from '@/app/services/axios';

type SearchScope =
  | 'templates'
  | 'tasks'
  | 'documents'
  | 'medications'
  | 'inventory-items'
  | 'services'
  | 'packages';

export type ScopedSearchParams = {
  q?: string;
  limit?: number;
  cursor?: string;
  [key: string]: string | number | boolean | undefined;
};

export type ScopedSearchResult = Record<string, unknown>;

export const searchOrganisationScope = async (
  organisationId: string,
  scope: SearchScope,
  params: ScopedSearchParams = {}
) => {
  const res = await getData<ScopedSearchResult[]>(
    `/v1/search/organisations/${organisationId}/${scope}`,
    params
  );
  return res.data ?? [];
};

export const searchTemplates = (organisationId: string, params: ScopedSearchParams = {}) =>
  searchOrganisationScope(organisationId, 'templates', params);

export const searchTasks = (organisationId: string, params: ScopedSearchParams = {}) =>
  searchOrganisationScope(organisationId, 'tasks', params);

export const searchDocuments = (organisationId: string, params: ScopedSearchParams = {}) =>
  searchOrganisationScope(organisationId, 'documents', params);

export const searchMedications = (organisationId: string, params: ScopedSearchParams = {}) =>
  searchOrganisationScope(organisationId, 'medications', params);

export const searchInventoryItems = (organisationId: string, params: ScopedSearchParams = {}) =>
  searchOrganisationScope(organisationId, 'inventory-items', params);

export const searchServices = (organisationId: string, params: ScopedSearchParams = {}) =>
  searchOrganisationScope(organisationId, 'services', params);

export const searchPackages = (organisationId: string, params: ScopedSearchParams = {}) =>
  searchOrganisationScope(organisationId, 'packages', params);
