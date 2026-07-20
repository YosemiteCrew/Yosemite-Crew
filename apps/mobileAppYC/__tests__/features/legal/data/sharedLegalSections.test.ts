import {
  createBookingRecipientsList,
  createCompanyIntro,
  createRomanList,
} from '../../../../src/features/legal/data/sharedLegalSections';

describe('sharedLegalSections', () => {
  describe('createCompanyIntro', () => {
    it('builds the company intro paragraph with any additional segments appended', () => {
      const extra = {text: ' Extra clause.'};
      const result = createCompanyIntro(extra);

      expect(result.type).toBe('paragraph');
      expect(result.segments[0].text).toContain('DuneXploration UG');
      expect(result.segments[1]).toBe(extra);
    });
  });

  describe('createBookingRecipientsList', () => {
    it('omits the additional recipient item when none is provided', () => {
      const result = createBookingRecipientsList();
      expect(result.items).toHaveLength(2);
    });

    it('appends the additional recipient item when provided', () => {
      const result = createBookingRecipientsList('Some Other Recipient');
      expect(result.items).toHaveLength(3);
    });
  });

  describe('createRomanList', () => {
    it('uses roman numerals for the first ten items', () => {
      const result = createRomanList('a', 'b');
      expect(result.items[0].marker).toBe('(i)');
      expect(result.items[1].marker).toBe('(ii)');
    });

    it('falls back to arabic numerals beyond the eleventh item', () => {
      const items = Array.from({length: 11}, (_, i) => `item-${i}`);
      const result = createRomanList(...items);
      expect(result.items[10].marker).toBe('(11)');
    });
  });
});
