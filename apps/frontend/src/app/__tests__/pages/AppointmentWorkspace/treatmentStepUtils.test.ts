import { PRESCRIPTION_INVENTORY_CATEGORIES } from '@/app/features/appointments/pages/AppointmentWorkspace/steps/treatmentStepUtils';
import { CategoryOptionsByBusiness } from '@/app/features/inventory/pages/Inventory/types';

describe('PRESCRIPTION_INVENTORY_CATEGORIES', () => {
  const canonicalLowercased = new Set(
    Object.values(CategoryOptionsByBusiness)
      .flat()
      .map((category) => category.trim().toLowerCase())
  );

  it('has a canonical list to compare against', () => {
    // Without this the suite below would vacuously pass on an empty set.
    expect(canonicalLowercased.size).toBeGreaterThan(0);
    expect(PRESCRIPTION_INVENTORY_CATEGORIES.size).toBeGreaterThan(0);
  });

  // TreatmentStep matches on `basicInfo.category.toLowerCase()`, so every entry here has
  // to name a real inventory category once lower-cased. 'iv/fluid therapy' did not: the
  // canonical 'IV / Fluid therapy' lower-cases with spaces around the slash, so the entry
  // matched nothing and IV/fluid items could never be prescribed.
  it.each([...PRESCRIPTION_INVENTORY_CATEGORIES])(
    'entry "%s" names a real inventory category',
    (entry) => {
      expect(canonicalLowercased.has(entry)).toBe(true);
    }
  );

  it('accepts the canonical IV / Fluid therapy category', () => {
    expect(PRESCRIPTION_INVENTORY_CATEGORIES.has('IV / Fluid therapy'.toLowerCase())).toBe(true);
  });
});
