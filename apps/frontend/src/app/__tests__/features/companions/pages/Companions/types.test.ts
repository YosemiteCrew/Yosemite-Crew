import {
  CompanionsSpeciesFilters,
  CompanionsStatusFilters,
  dropdownStatusFromToken,
  filter,
  status,
  statusFromToken,
} from '@/app/features/companions/pages/Companions/types';

describe('Companions filter helpers', () => {
  describe('filter', () => {
    it('builds a name/key pair', () => {
      expect(filter('All', 'all')).toEqual({ name: 'All', key: 'all' });
    });
  });

  describe('status', () => {
    it('applies the default text color and falls back border to bg', () => {
      expect(status('Active', 'active', 'red')).toEqual({
        name: 'Active',
        key: 'active',
        bg: 'red',
        text: 'var(--color-neutral-0)',
        border: 'red',
        dropdownText: undefined,
      });
    });

    it('keeps explicit text, border and dropdownText', () => {
      expect(status('Paid', 'paid', 'bg', 'text', 'border', 'dropdown')).toEqual({
        name: 'Paid',
        key: 'paid',
        bg: 'bg',
        text: 'text',
        border: 'border',
        dropdownText: 'dropdown',
      });
    });
  });

  describe('statusFromToken', () => {
    it('derives bg, text and border from one CSS custom-property prefix', () => {
      expect(statusFromToken('Upcoming', 'upcoming', 'status-upcoming')).toEqual({
        name: 'Upcoming',
        key: 'upcoming',
        bg: 'var(--status-upcoming-bg)',
        text: 'var(--status-upcoming-text)',
        border: 'var(--status-upcoming-border)',
        dropdownText: undefined,
      });
    });
  });

  describe('dropdownStatusFromToken', () => {
    it('adds the derived text token as dropdownText', () => {
      expect(dropdownStatusFromToken('Paid', 'paid', 'color-pill-success')).toEqual({
        name: 'Paid',
        key: 'paid',
        bg: 'var(--color-pill-success-bg)',
        text: 'var(--color-pill-success-text)',
        border: 'var(--color-pill-success-border)',
        dropdownText: 'var(--color-pill-success-text)',
      });
    });
  });

  describe('CompanionsSpeciesFilters', () => {
    it('lists the five species filters', () => {
      expect(CompanionsSpeciesFilters).toEqual([
        { name: 'All', key: 'all' },
        { name: 'Canine', key: 'dog' },
        { name: 'Equine', key: 'horse' },
        { name: 'Feline', key: 'cat' },
        { name: 'Other', key: 'other' },
      ]);
    });
  });

  describe('CompanionsStatusFilters', () => {
    it('keeps the pill tokens for every companion status', () => {
      expect(CompanionsStatusFilters.map((option) => option.key)).toEqual([
        'all',
        'active',
        'inactive',
        'archived',
      ]);
      expect(CompanionsStatusFilters[1]).toEqual({
        name: 'Active',
        key: 'active',
        bg: 'var(--color-pill-success-bg)',
        text: 'var(--color-pill-success-text)',
        border: 'var(--color-pill-success-border)',
        dropdownText: 'var(--color-pill-success-text)',
      });
    });
  });
});
