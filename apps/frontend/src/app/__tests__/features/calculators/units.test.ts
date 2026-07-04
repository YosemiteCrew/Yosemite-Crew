import { lbsToKg } from '@/app/features/calculators/utils/units';

describe('lbsToKg', () => {
  it('converts pounds to kilograms rounded to 2 dp', () => {
    expect(lbsToKg(15)).toBe(6.8);
    expect(lbsToKg(2.20462)).toBe(1);
  });
});
