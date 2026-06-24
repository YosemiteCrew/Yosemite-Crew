import {
  SubCategoryByCategory,
  SubCategoryOptions,
  getSubCategoryOptions,
} from '@/app/features/inventory/pages/Inventory/types';

describe('inventory subcategory taxonomy', () => {
  it('maps each category to its own subcategories', () => {
    expect(SubCategoryByCategory.Vaccine).toEqual([
      'Core vaccine',
      'Non-core vaccine',
      'Rabies',
      'DHPP',
      'FVRCP',
      'Bordetella',
      'Leptospirosis',
    ]);
    expect(SubCategoryByCategory['Wound care']).toEqual([
      'Bandage roll',
      'Dressing',
      'Antiseptic',
      'Wound spray',
      'Tape',
    ]);
  });

  it('scopes getSubCategoryOptions to the selected category', () => {
    expect(getSubCategoryOptions('Vaccine')).toEqual(SubCategoryByCategory.Vaccine);
    // Vaccine subcategories must not leak Medicine subcategories.
    expect(getSubCategoryOptions('Vaccine')).not.toContain('Antibiotic');
  });

  it('falls back to the full flat list when no/unknown category is given', () => {
    expect(getSubCategoryOptions()).toBe(SubCategoryOptions);
    expect(getSubCategoryOptions('Nonexistent')).toBe(SubCategoryOptions);
    // The flat list is the de-duplicated union of every category's subcategories.
    expect(SubCategoryOptions).toContain('Antibiotic');
    expect(SubCategoryOptions).toContain('Tape');
  });
});
