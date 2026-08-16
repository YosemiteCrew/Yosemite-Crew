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

/**
 * Build a StatusOption whose bg/text/border all derive from one CSS custom-property
 * prefix (`--<cssPrefix>-bg` / `-text` / `-border`), so status tables stay one line
 * per entry instead of repeating three var() literals each.
 */
export const statusFromToken = (name: string, key: string, cssPrefix: string): StatusOption =>
  status(
    name,
    key,
    `var(--${cssPrefix}-bg)`,
    `var(--${cssPrefix}-text)`,
    `var(--${cssPrefix}-border)`
  );

/** Like statusFromToken, but also reuses the derived text token as dropdownText. */
export const dropdownStatusFromToken = (
  name: string,
  key: string,
  cssPrefix: string
): StatusOption => ({
  ...statusFromToken(name, key, cssPrefix),
  dropdownText: `var(--${cssPrefix}-text)`,
});

export const CompanionsSpeciesFilters: FilterOption[] = [
  filter('All', 'all'),
  filter('Canine', 'dog'),
  filter('Equine', 'horse'),
  filter('Feline', 'cat'),
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
