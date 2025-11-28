import { FAQ_CATEGORIES, FAQ_ENTRIES } from '../../../../src/features/support/data/faqData';

describe('FAQ Data', () => {
  describe('Categories', () => {
    it('should have unique IDs', () => {
      const ids = FAQ_CATEGORIES.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should contain required standard categories', () => {
      const requiredCategories = ['all', 'getting-started', 'account', 'support'];
      const ids = FAQ_CATEGORIES.map(c => c.id);

      // Fix: Use for...of loop instead of forEach
      for (const req of requiredCategories) {
        expect(ids).toContain(req);
      }
    });
  });

  describe('Entries', () => {
    it('should have unique IDs', () => {
      const ids = FAQ_ENTRIES.map(e => e.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should map compact data correctly to FAQEntry structure', () => {
      const entry = FAQ_ENTRIES[0];
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('question');
      expect(entry).toHaveProperty('answer');
      expect(entry).toHaveProperty('categoryIds');
      expect(Array.isArray(entry.categoryIds)).toBe(true);
    });

    it('every categoryId in entries should exist in FAQ_CATEGORIES', () => {
      const validCategoryIds = new Set(FAQ_CATEGORIES.map(c => c.id));

      // Fix: Use for...of loop to reduce nesting depth and replace forEach
      for (const entry of FAQ_ENTRIES) {
        for (const catId of entry.categoryIds) {
          expect(validCategoryIds.has(catId)).toBe(true);
        }
      }
    });

    it('relatedIds should be undefined or an array of strings', () => {
      // Fix: Use for...of loop instead of forEach
      for (const entry of FAQ_ENTRIES) {
        if (entry.relatedIds) {
            expect(Array.isArray(entry.relatedIds)).toBe(true);
            for (const id of entry.relatedIds) {
                expect(typeof id).toBe('string');
            }
        } else {
            expect(entry.relatedIds).toBeUndefined();
        }
      }
    });

    it('should correctly split comma-separated categories', () => {
        // Find an entry known to have multiple categories
        const multiCatEntry = FAQ_ENTRIES.find(e => e.id === 'how-to-sign-up');
        expect(multiCatEntry).toBeDefined();
        expect(multiCatEntry?.categoryIds).toContain('getting-started');
        expect(multiCatEntry?.categoryIds).toContain('account');
        expect(multiCatEntry?.categoryIds.length).toBeGreaterThanOrEqual(2);
    });
  });
});