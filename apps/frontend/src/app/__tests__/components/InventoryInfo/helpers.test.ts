import {
  formatDate,
  formatFinalValue,
  formatDateValue,
  getBasicInfoErrors,
  getFieldDisplay,
  getPricingErrors,
  getPrimaryButtonText,
  getStockErrors,
  normalizeOptions,
  parseDate,
  resolveLabel,
  validateNumberField,
} from '@/app/features/inventory/components/InventoryInfo';

jest.mock('@/app/features/inventory/pages/Inventory/utils', () => ({
  formatDisplayDate: jest.fn((value) => (value ? `Formatted ${value}` : '')),
  toStringSafe: jest.fn((value) => (value === null || value === undefined ? '' : String(value))),
  formatCurrencyValue: jest.fn(),
  formatPercentValue: jest.fn(),
  getGrossProfitPerUnit: jest.fn(),
  getMarginPercent: jest.fn(),
  getStockValue: jest.fn(),
}));

describe('InventoryInfo helpers', () => {
  const inventory = {
    basicInfo: { name: 'Inventory Item', category: 'Medicine' },
    pricing: { purchaseCost: '10', selling: '20' },
    stock: { current: '5', reorderLevel: '2' },
  } as any;

  it('validates required and numeric number fields', () => {
    expect(validateNumberField('', 'Required', 'Invalid')).toBe('Required');
    expect(validateNumberField('abc', 'Required', 'Invalid')).toBe('Invalid');
    expect(validateNumberField('12', 'Required', 'Invalid')).toBeNull();
  });

  it('returns basic info validation errors when required values are absent', () => {
    expect(getBasicInfoErrors({}, { basicInfo: {} } as any)).toEqual({
      name: 'Name is required',
      category: 'Category is required',
    });
    expect(getBasicInfoErrors({ name: 'New', category: 'Food' }, inventory)).toEqual({});
  });

  it('returns pricing and stock validation errors for missing or invalid numbers', () => {
    expect(getPricingErrors({ purchaseCost: '', selling: 'bad' }, inventory)).toEqual({
      purchaseCost: 'Purchase cost is required',
      selling: 'Enter a valid number',
    });
    expect(getStockErrors({ current: 'bad', reorderLevel: '' }, inventory)).toEqual({
      current: 'Enter a valid number',
      reorderLevel: 'Reorder level is required',
    });
  });

  it('parses ISO, dd/mm/yyyy, and invalid dates correctly', () => {
    expect(parseDate('2026-07-06')?.toISOString()).toContain('2026-07-06');
    expect(parseDate('06/07/2026')?.toISOString()).toContain('2026-07-06');
    expect(parseDate('not-a-date')).toBeNull();
  });

  it('formats dates as yyyy-mm-dd', () => {
    expect(formatDate(new Date('2026-07-06T00:00:00.000Z'))).toBe('2026-07-06');
  });

  it('normalizes options and resolves labels with fallback', () => {
    const options = normalizeOptions(['One', { label: 'Two Label', value: 'two' }]);

    expect(options).toEqual([
      { label: 'One', value: 'One' },
      { label: 'Two Label', value: 'two' },
    ]);
    expect(resolveLabel(options, 'two')).toBe('Two Label');
    expect(resolveLabel(options, 'missing')).toBe('missing');
  });

  it('formats date and final values with fallbacks', () => {
    expect(formatDateValue('2026-07-06')).toBe('Formatted 2026-07-06');
    expect(formatDateValue('')).toBe('—');
    expect(formatFinalValue(['A', 'B'])).toBe('A, B');
    expect(formatFinalValue([])).toBe('—');
    expect(formatFinalValue('Ready')).toBe('Ready');
    expect(formatFinalValue('')).toBe('—');
  });

  it('formats field display for multi-select, dropdown, date, and plain values', () => {
    const dropdownOptions = normalizeOptions(['30 days']);

    expect(getFieldDisplay('multiSelect', 'A, B', dropdownOptions)).toEqual(['A', 'B']);
    expect(getFieldDisplay('multiSelect', [], dropdownOptions)).toEqual([]);
    expect(getFieldDisplay('dropdown', '30 days', dropdownOptions)).toBe('30 days');
    expect(getFieldDisplay('dropdown', '', dropdownOptions)).toBe('—');
    expect(getFieldDisplay('date', '2026-07-06', dropdownOptions)).toBe('Formatted 2026-07-06');
    expect(getFieldDisplay('text', 42, dropdownOptions)).toBe('42');
  });

  it('returns the correct primary button text for edit, hide, and hidden states', () => {
    expect(getPrimaryButtonText(true, true, false, false)).toBe('Saving...');
    expect(getPrimaryButtonText(true, false, false, false)).toBe('Save');
    expect(getPrimaryButtonText(false, false, true, false)).toBe('Hiding...');
    expect(getPrimaryButtonText(false, false, true, true)).toBe('Unhiding...');
    expect(getPrimaryButtonText(false, false, false, true)).toBe('Restore item');
    expect(getPrimaryButtonText(false, false, false, false)).toBe('Delete item');
  });
});
