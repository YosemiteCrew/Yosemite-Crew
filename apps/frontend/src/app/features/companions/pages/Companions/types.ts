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
  dropdownText?: string;
};

export const filter = (name: string, key: string): FilterOption => ({ name, key });

export const status = (
  name: string,
  key: string,
  bg: string,
  text: string = 'var(--color-neutral-0)',
  border?: string,
  dropdownText?: string
): StatusOption => ({ name, key, bg, text, border: border ?? bg, dropdownText });

export const CompanionsSpeciesFilters: FilterOption[] = [
  filter('All', 'all'),
  filter('Dog', 'dog'),
  filter('Horse', 'horse'),
  filter('Cat', 'cat'),
  filter('Other', 'other'),
];

export const CompanionsStatusFilters: StatusOption[] = [
  status(
    'All',
    'all',
    'var(--color-pill-neutral-bg)',
    'var(--color-pill-neutral-text)',
    'var(--color-pill-neutral-border)',
    'var(--color-pill-neutral-text)'
  ),
  status(
    'Active',
    'active',
    'var(--color-pill-success-bg)',
    'var(--color-pill-success-text)',
    'var(--color-pill-success-border)',
    'var(--color-pill-success-text)'
  ),
  status(
    'Inactive',
    'inactive',
    'var(--color-pill-neutral-bg)',
    'var(--color-pill-neutral-text)',
    'var(--color-pill-neutral-border)',
    'var(--color-pill-neutral-text)'
  ),
  status(
    'Archived',
    'archived',
    'var(--color-pill-warning-bg)',
    'var(--color-pill-warning-text)',
    'var(--color-pill-warning-border)',
    'var(--color-pill-warning-text)'
  ),
];
