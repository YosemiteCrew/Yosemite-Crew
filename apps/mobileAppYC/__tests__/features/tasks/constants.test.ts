import {REMINDER_OPTIONS} from '../../../src/features/tasks/constants';

describe('features/tasks/constants', () => {
  describe('REMINDER_OPTIONS', () => {
    it('should be an array', () => {
      expect(Array.isArray(REMINDER_OPTIONS)).toBe(true);
    });

    it('should have exactly 6 options', () => {
      expect(REMINDER_OPTIONS).toHaveLength(6);
    });

    it('should contain the correct string values in the correct order', () => {
      const expectedOptions = [
        '5-mins-prior',
        '30-mins-prior',
        '1-hour-prior',
        '12-hours-prior',
        '1-day-prior',
        '3-days-prior',
      ];

      expect(REMINDER_OPTIONS).toEqual(expectedOptions);
    });

    it('should match snapshot', () => {
      expect(REMINDER_OPTIONS).toMatchInlineSnapshot(`
        [
          "5-mins-prior",
          "30-mins-prior",
          "1-hour-prior",
          "12-hours-prior",
          "1-day-prior",
          "3-days-prior",
        ]
      `);
    });
  });
});