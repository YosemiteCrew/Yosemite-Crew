import {
  buildPagerPageList,
  getInvoiceItemNames,
  getInvoiceStatusStyle,
  getInventoryStatusStyle,
  formatWeeklyWorkingHours,
  getAvailabilityStatusStyle,
  getCompanionStatusStyle,
  getCompanionStatusTone,
  getFormsStatusStyle,
  getFormsStatusTone,
  getInventoryTurnoverStatusStyle,
  formatTurnoverStatus,
  getTaskStatusStyle,
  getOrganizationStatusStyle,
  getServiceNames,
  getStringified,
  joinNames,
} from '@/app/ui/tables/tableUtils';

describe('tableUtils', () => {
  describe('getInvoiceItemNames', () => {
    it('joins trimmed names', () => {
      expect(getInvoiceItemNames([{ name: ' A ' }, { name: 'B' }] as any)).toBe('A, B');
    });

    it('filters out empty/undefined names', () => {
      expect(getInvoiceItemNames([{ name: '' }, { name: undefined }, { name: 'C' }] as any)).toBe(
        'C'
      );
    });
  });

  describe('getInvoiceStatusStyle', () => {
    it.each([
      ['awaiting_payment', 'var(--color-pill-info-text)'],
      ['paid', 'var(--color-pill-success-text)'],
      ['failed', 'var(--color-pill-warning-text)'],
      ['cancelled', 'var(--color-pill-warning-text)'],
      ['refunded', 'var(--color-pill-progress-text)'],
      ['pending', 'var(--color-pill-neutral-text)'],
      ['unknown', 'var(--color-pill-neutral-text)'],
    ])('returns style for %s', (status, color) => {
      expect(getInvoiceStatusStyle(status).color).toBe(color);
    });

    it('handles undefined status', () => {
      expect(getInvoiceStatusStyle(undefined as any).color).toBe('var(--color-pill-neutral-text)');
    });
  });

  describe('getInventoryStatusStyle', () => {
    it('delegates to inventory badge style', () => {
      expect(getInventoryStatusStyle('active')).toBeDefined();
    });
  });

  describe('formatWeeklyWorkingHours', () => {
    it('formats a numeric value', () => {
      expect(formatWeeklyWorkingHours(40 as any)).toBe('40');
    });

    it('formats decimal value with max 2 fraction digits', () => {
      expect(formatWeeklyWorkingHours(37.5 as any)).toBe('37.5');
    });

    it('returns raw value when NaN and value is truthy', () => {
      expect(formatWeeklyWorkingHours('bad' as any)).toBe('bad');
    });

    it('returns "0" when NaN and value is falsy', () => {
      expect(formatWeeklyWorkingHours('' as any)).toBe('0');
    });
  });

  describe('getAvailabilityStatusStyle', () => {
    it.each(['available', 'consulting', 'off-duty', 'requested', 'unknown'])(
      'returns a style for %s',
      (status) => {
        expect(getAvailabilityStatusStyle(status)).toHaveProperty('color');
      }
    );
  });

  describe('getCompanionStatusStyle', () => {
    it.each(['active', 'archived', 'inactive', 'unknown'])('returns a style for %s', (status) => {
      expect(getCompanionStatusStyle(status)).toHaveProperty('color');
    });
  });

  describe('getCompanionStatusTone', () => {
    it.each([
      ['active', 'success'],
      ['archived', 'warning'],
      ['inactive', 'neutral'],
      ['unknown', 'neutral'],
      [undefined, 'neutral'],
    ])('maps %s to %s', (status, tone) => {
      expect(getCompanionStatusTone(status as any)).toBe(tone);
    });
  });

  describe('getFormsStatusStyle', () => {
    it('returns neutral style for empty status', () => {
      expect(getFormsStatusStyle('' as any).color).toBe('var(--color-pill-neutral-text)');
    });

    it.each(['published', 'draft', 'archived', 'unknown'])('returns a style for %s', (status) => {
      expect(getFormsStatusStyle(status)).toHaveProperty('color');
    });
  });

  describe('getFormsStatusTone', () => {
    it.each([
      ['Published', 'success'],
      ['Draft', 'neutral'],
      ['Archived', 'neutral'],
      ['Superseded', 'progress'],
      ['', 'neutral'],
      [undefined, 'neutral'],
    ])('maps %s to %s', (status, tone) => {
      expect(getFormsStatusTone(status as any)).toBe(tone);
    });
  });

  describe('getInventoryTurnoverStatusStyle', () => {
    it.each(['excellent', 'healthy', 'low', 'out of stock', 'moderate', 'unknown', undefined])(
      'returns a style for %s',
      (status) => {
        expect(getInventoryTurnoverStatusStyle(status as any)).toHaveProperty('color');
      }
    );
  });

  describe('formatTurnoverStatus', () => {
    it('returns em dash for empty status', () => {
      expect(formatTurnoverStatus(undefined)).toBe('—');
      expect(formatTurnoverStatus('')).toBe('—');
    });

    it('title-cases each word', () => {
      expect(formatTurnoverStatus('out of stock')).toBe('Out Of Stock');
    });
  });

  describe('getTaskStatusStyle', () => {
    it.each(['pending', 'in_progress', 'completed', 'unknown'])(
      'returns a style for %s',
      (status) => {
        expect(getTaskStatusStyle(status)).toHaveProperty('color');
      }
    );

    it('handles undefined status', () => {
      expect(getTaskStatusStyle(undefined as any)).toHaveProperty('color');
    });
  });

  describe('getOrganizationStatusStyle', () => {
    it.each(['active', 'pending', 'unknown'])('returns a style for %s', (status) => {
      expect(getOrganizationStatusStyle(status)).toHaveProperty('color');
    });

    it('handles undefined status', () => {
      expect(getOrganizationStatusStyle(undefined as any)).toHaveProperty('color');
    });
  });

  describe('getServiceNames', () => {
    it('joins service names', () => {
      expect(getServiceNames([{ name: 'A' }, { name: 'B' }])).toBe('A, B');
    });

    it('defaults to empty array', () => {
      expect(getServiceNames()).toBe('');
    });
  });

  describe('getStringified', () => {
    it('joins strings', () => {
      expect(getStringified(['A', 'B'])).toBe('A, B');
    });

    it('defaults to empty array', () => {
      expect(getStringified()).toBe('');
    });
  });

  describe('joinNames', () => {
    const byId = { '1': 'Room One', '2': 'Room Two' };

    it('resolves string ids via byId map', () => {
      expect(joinNames(byId, ['1', '2'])).toBe('Room One, Room Two');
    });

    it('resolves object refs with their own name', () => {
      expect(joinNames(byId, [{ id: '1', name: 'Custom Name' } as any])).toBe('Custom Name');
    });

    it('falls back to byId lookup when object ref has no name', () => {
      expect(joinNames(byId, [{ id: '2' } as any])).toBe('Room Two');
    });

    it('filters out unresolved ids', () => {
      expect(joinNames(byId, ['missing'])).toBe('-');
    });

    it('defaults to empty array and returns dash', () => {
      expect(joinNames(byId)).toBe('-');
    });
  });

  describe('buildPagerPageList', () => {
    it('lists every page uncollapsed while the run fits the pill limit', () => {
      expect(buildPagerPageList(1, 3)).toEqual([
        { key: 'page-1', page: 1 },
        { key: 'page-2', page: 2 },
        { key: 'page-3', page: 3 },
      ]);
    });

    it('collapses both ends behind gaps keyed by the page they follow', () => {
      expect(buildPagerPageList(10, 20)).toEqual([
        { key: 'page-1', page: 1 },
        { key: 'gap-after-1', page: null },
        { key: 'page-9', page: 9 },
        { key: 'page-10', page: 10 },
        { key: 'page-11', page: 11 },
        { key: 'gap-after-11', page: null },
        { key: 'page-20', page: 20 },
      ]);
    });

    it('clamps the window at the first and last page', () => {
      expect(buildPagerPageList(1, 20).map((entry) => entry.page)).toEqual([1, 2, null, 20]);
      expect(buildPagerPageList(20, 20).map((entry) => entry.page)).toEqual([1, null, 19, 20]);
    });

    it('gives every slot in a run a unique key so React never falls back to position', () => {
      for (const current of [1, 2, 5, 10, 19, 20]) {
        const keys = buildPagerPageList(current, 20).map((entry) => entry.key);
        expect(new Set(keys).size).toBe(keys.length);
      }
    });

    it('returns an empty run when there are no pages', () => {
      expect(buildPagerPageList(1, 0)).toEqual([]);
    });
  });
});
