import {
  countBookableBreakdownItems,
  hasBookableBreakdownItem,
  hasInpatientBreakdownItem,
} from '@/app/features/organization/services/catalogBookable';
import { PackageBreakdownItem } from '@/app/features/organization/types/revamp';

const item = (overrides: Partial<PackageBreakdownItem>): PackageBreakdownItem => ({
  id: overrides.id ?? 'i',
  type: 'CONSULTATION',
  name: overrides.name ?? 'Item',
  unitPrice: 0,
  quantity: 1,
  discount: 0,
  ...overrides,
});

describe('catalogBookable', () => {
  it('detects a directly bookable item', () => {
    expect(hasBookableBreakdownItem([item({ isBookable: true })])).toBe(true);
  });

  it('detects a bookable item nested inside a package breakdown', () => {
    const nested = item({
      id: 'parent',
      nestedBreakdown: [item({ id: 'child', isBookable: true })],
    });
    expect(hasBookableBreakdownItem([nested])).toBe(true);
  });

  it('returns false when nothing is bookable', () => {
    expect(hasBookableBreakdownItem([item({ isBookable: false })])).toBe(false);
  });

  it('detects inpatient preference directly and nested', () => {
    expect(hasInpatientBreakdownItem([item({ isInpatientPreferred: true })])).toBe(true);
    const nested = item({
      id: 'parent',
      nestedBreakdown: [item({ id: 'child', isInpatientPreferred: true })],
    });
    expect(hasInpatientBreakdownItem([nested])).toBe(true);
    expect(hasInpatientBreakdownItem([item({})])).toBe(false);
  });

  it('counts bookable items including nested ones, once per item', () => {
    const breakdown = [
      item({ id: 'a', isBookable: true }),
      item({ id: 'b', isBookable: false }),
      item({ id: 'c', nestedBreakdown: [item({ id: 'c1', isBookable: true })] }),
    ];
    expect(countBookableBreakdownItems(breakdown)).toBe(2);
  });
});
