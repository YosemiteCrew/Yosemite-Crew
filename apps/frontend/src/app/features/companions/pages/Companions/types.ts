import { Companion, CompanionRequestDTO, Parent, ParentRequestDTO } from '@yosemite-crew/types';

export type StoredParent = Parent & {
  id: string;
};

export type StoredCompanion = Companion & {
  id: string;
  organisationId: string;
  parentId: string;
};

export type CompanionParent = {
  companion: StoredCompanion;
  parent: StoredParent;
};

export type RequestCompanion = {
  companion: CompanionRequestDTO;
  parent: ParentRequestDTO;
};

export type GetCompanionResponse = RequestCompanion[];

export type FilterOption = {
  name: string;
  key: string;
};

export type StatusOption = FilterOption & {
  bg?: string;
  text?: string;
  border?: string;
};

export const filter = (name: string, key: string): FilterOption => ({ name, key });

export const status = (
  name: string,
  key: string,
  bg: string,
  text: string = '#fff',
  border?: string
): StatusOption => ({ name, key, bg, text, border: border ?? bg });

export const CompanionsSpeciesFilters: FilterOption[] = [
  filter('All', 'all'),
  filter('Dog', 'dog'),
  filter('Horse', 'horse'),
  filter('Cat', 'cat'),
  filter('Other', 'other'),
];

export const CompanionsStatusFilters: StatusOption[] = [
  status('All', 'all', '#5C614B'),
  status('Active', 'active', '#D28F9A'),
  status('Inactive', 'inactive', '#BF9FAA'),
  status('Archived', 'archived', '#747283'),
];
