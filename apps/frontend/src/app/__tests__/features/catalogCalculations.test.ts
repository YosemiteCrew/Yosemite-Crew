import {
  generateCode,
  computePackageBreakdownItem,
  computePackageTotals,
  computeServiceTotal,
  resetCounters,
} from '@/app/features/organization/services/catalogCalculations';
import { PackageRevamp, ServiceRevamp } from '@/app/features/organization/types/revamp';

describe('generateCode', () => {
  beforeEach(() => {
    resetCounters({
      CONSULTATION: 0,
      PROCEDURE: 0,
      INVENTORY: 0,
      LAB: 0,
      MEDICATION: 0,
      PACKAGE: 0,
    });
  });

  it('generates CS prefix for CONSULTATION', () => {
    expect(generateCode('CONSULTATION')).toBe('CS-0001');
    expect(generateCode('CONSULTATION')).toBe('CS-0002');
  });

  it('generates PR prefix for PROCEDURE', () => {
    expect(generateCode('PROCEDURE')).toBe('PR-0001');
  });

  it('generates LB prefix for LAB', () => {
    expect(generateCode('LAB')).toBe('LB-0001');
  });

  it('generates PK prefix for PACKAGE', () => {
    expect(generateCode('PACKAGE')).toBe('PK-0001');
  });

  it('pads counter to 4 digits', () => {
    for (let i = 0; i < 9; i++) generateCode('MEDICATION');
    expect(generateCode('MEDICATION')).toBe('ME-0010');
  });
});

describe('computeServiceTotal', () => {
  it('computes default discount correctly', () => {
    const svc = { grossAmount: 1000, defaultDiscount: 10 } as ServiceRevamp;
    const { defaultDiscountAmt, total } = computeServiceTotal(svc);
    expect(defaultDiscountAmt).toBe(100);
    expect(total).toBe(900);
  });

  it('handles zero discount', () => {
    const svc = { grossAmount: 500, defaultDiscount: 0 } as ServiceRevamp;
    const { defaultDiscountAmt, total } = computeServiceTotal(svc);
    expect(defaultDiscountAmt).toBe(0);
    expect(total).toBe(500);
  });
});

describe('computePackageBreakdownItem', () => {
  it('computes gross, discountAmt, net correctly', () => {
    const item = {
      unitPrice: 100,
      quantity: 2,
      discount: 10,
      id: '1',
      type: 'CONSULTATION',
      name: 'X',
    } as any;
    const { gross, discountAmt, net } = computePackageBreakdownItem(item);
    expect(gross).toBe(200);
    expect(discountAmt).toBe(20);
    expect(net).toBe(180);
  });
});

describe('computePackageTotals', () => {
  it('computes totals with additional discount', () => {
    const pkg: PackageRevamp = {
      id: 'p1',
      code: 'PK-0001',
      name: 'Test',
      description: '',
      specialityId: 'spec-1',
      organisationId: 'org-1',
      durationText: 'Approx. 30 mins',
      isBookable: false,
      isInpatientPreferred: false,
      leadCount: 1,
      supportCount: 0,
      additionalDiscount: 10,
      breakdown: [
        { id: 'b1', type: 'CONSULTATION', name: 'A', unitPrice: 100, quantity: 1, discount: 0 },
        { id: 'b2', type: 'LAB', name: 'B', unitPrice: 200, quantity: 1, discount: 0 },
      ],
      status: 'ACTIVE',
      createdAt: '2025-01-01T00:00:00Z',
    };
    const { grossTotal, afterItemDiscounts, additionalDiscountAmt, totalCost } =
      computePackageTotals(pkg);
    expect(grossTotal).toBe(300);
    expect(afterItemDiscounts).toBe(300);
    expect(additionalDiscountAmt).toBe(30);
    expect(totalCost).toBe(270);
  });

  it('handles empty breakdown', () => {
    const pkg: PackageRevamp = {
      id: 'p2',
      code: 'PK-0002',
      name: 'Empty',
      description: '',
      specialityId: 'spec-1',
      organisationId: 'org-1',
      durationText: 'Approx. 30 mins',
      isBookable: false,
      isInpatientPreferred: false,
      leadCount: 1,
      supportCount: 0,
      additionalDiscount: 5,
      breakdown: [],
      status: 'ACTIVE',
      createdAt: '2025-01-01T00:00:00Z',
    };
    const { grossTotal, totalCost } = computePackageTotals(pkg);
    expect(grossTotal).toBe(0);
    expect(totalCost).toBe(0);
  });

  it('falls back to serverFinalAmount when breakdown is not loaded', () => {
    const pkg: PackageRevamp = {
      id: 'p3',
      code: 'PK-0003',
      name: 'List row without breakdown',
      description: '',
      specialityId: 'spec-1',
      organisationId: 'org-1',
      durationText: 'Approx. 30 mins',
      isBookable: false,
      isInpatientPreferred: false,
      leadCount: 1,
      supportCount: 0,
      additionalDiscount: 5,
      breakdown: [],
      serverFinalAmount: 130.15,
      status: 'ACTIVE',
      createdAt: '2025-01-01T00:00:00Z',
    };
    const { totalCost } = computePackageTotals(pkg);
    expect(totalCost).toBe(130.15);
  });
});
