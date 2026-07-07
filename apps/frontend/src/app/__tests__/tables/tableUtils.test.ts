import {
  getInvoiceItemNames,
  getInvoiceStatusStyle,
  getInventoryStatusStyle,
  formatWeeklyWorkingHours,
  getAvailabilityStatusStyle,
  getCompanionStatusStyle,
  getFormsStatusStyle,
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

  describe('getFormsStatusStyle', () => {
    it('returns neutral style for empty status', () => {
      expect(getFormsStatusStyle('' as any).color).toBe('var(--color-pill-neutral-text)');
    });

    it.each(['published', 'draft', 'archived', 'unknown'])('returns a style for %s', (status) => {
      expect(getFormsStatusStyle(status)).toHaveProperty('color');
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
});
