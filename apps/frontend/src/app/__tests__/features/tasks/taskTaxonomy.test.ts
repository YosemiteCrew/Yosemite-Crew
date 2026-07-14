import {
  categoryFromLabel,
  categoryToKind,
  getTaskCategoryLabel,
  isSeriesTask,
  NO_REMINDER_VALUE,
  offsetToReminderValue,
  recurrenceToRepeatValue,
  reminderValueToOffset,
  repeatValueToRecurrence,
  TASK_CATEGORY_OPTIONS,
  TASK_REMINDER_OPTIONS,
  TASK_REPEAT_OPTIONS,
} from '@/app/features/tasks/constants/taskTaxonomy';

describe('taskTaxonomy', () => {
  describe('categories', () => {
    it('exposes the canonical 10 categories with value === code', () => {
      expect(TASK_CATEGORY_OPTIONS.map((o) => o.value)).toEqual([
        'MEDICATION',
        'CARE',
        'DIET',
        'PROCEDURE',
        'DIAGNOSTIC',
        'COMMUNICATION',
        'BILLING',
        'RECORD',
        'ADMIN',
        'CUSTOM',
      ]);
    });

    it('getTaskCategoryLabel maps codes to labels and falls back to the raw value', () => {
      expect(getTaskCategoryLabel('BILLING')).toBe('Billing');
      expect(getTaskCategoryLabel('Care')).toBe('Care'); // already a label / unknown code
      expect(getTaskCategoryLabel(undefined)).toBe('');
    });

    it('categoryFromLabel resolves labels and codes back to the canonical code', () => {
      expect(categoryFromLabel('Care')).toBe('CARE');
      expect(categoryFromLabel('billing')).toBe('BILLING');
      expect(categoryFromLabel('CARE')).toBe('CARE'); // already a code
      expect(categoryFromLabel('')).toBe('CARE'); // default
      expect(categoryFromLabel('Mystery')).toBe('Mystery'); // unknown passes through
    });
  });

  describe('isSeriesTask', () => {
    it('is true for a recurring master and for a materialized child', () => {
      expect(isSeriesTask({ type: 'DAILY', isMaster: true })).toBe(true);
      expect(isSeriesTask({ type: 'DAILY', isMaster: false, masterTaskId: 'm1' })).toBe(true);
    });

    it('is false for a one-off task or missing recurrence', () => {
      expect(isSeriesTask({ type: 'ONCE', isMaster: false })).toBe(false);
      expect(isSeriesTask({ type: 'ONCE', isMaster: true })).toBe(false); // ONCE master is not a series
      expect(isSeriesTask(undefined)).toBe(false);
    });
  });

  describe('categoryToKind', () => {
    it('keeps native Prisma kinds', () => {
      expect(categoryToKind('MEDICATION')).toBe('MEDICATION');
      expect(categoryToKind('DIET')).toBe('DIET');
      expect(categoryToKind('CUSTOM')).toBe('CUSTOM');
    });

    it('falls back to CUSTOM for categories that are not native kinds yet', () => {
      expect(categoryToKind('BILLING')).toBe('CUSTOM');
      expect(categoryToKind('care')).toBe('CUSTOM');
    });

    it('falls back to CUSTOM for empty/unknown values', () => {
      expect(categoryToKind('')).toBe('CUSTOM');
      expect(categoryToKind('NONSENSE')).toBe('CUSTOM');
      expect(categoryToKind(undefined)).toBe('CUSTOM');
    });
  });

  describe('reminders', () => {
    it('lists No reminder + the canonical offsets', () => {
      expect(TASK_REMINDER_OPTIONS.map((o) => o.value)).toEqual([
        NO_REMINDER_VALUE,
        '5',
        '15',
        '30',
        '60',
        '1440',
      ]);
    });

    it('reminderValueToOffset returns undefined for "no reminder" and parses offsets', () => {
      expect(reminderValueToOffset(NO_REMINDER_VALUE)).toBeUndefined();
      expect(reminderValueToOffset(undefined)).toBeUndefined();
      expect(reminderValueToOffset('30')).toBe(30);
      expect(reminderValueToOffset('0')).toBeUndefined();
    });

    it('offsetToReminderValue round-trips a known offset and the none sentinel', () => {
      expect(offsetToReminderValue(60)).toBe('60');
      expect(offsetToReminderValue(undefined)).toBe(NO_REMINDER_VALUE);
      expect(offsetToReminderValue(0)).toBe(NO_REMINDER_VALUE);
    });
  });

  describe('repeat / recurrence', () => {
    it('maps simple repeats to native recurrence types', () => {
      expect(repeatValueToRecurrence('ONCE')).toEqual({ type: 'ONCE', cronExpression: undefined });
      expect(repeatValueToRecurrence('DAILY')).toEqual({
        type: 'DAILY',
        cronExpression: undefined,
      });
      expect(repeatValueToRecurrence('WEEKLY')).toEqual({
        type: 'WEEKLY',
        cronExpression: undefined,
      });
    });

    it('maps interval repeats to CUSTOM + cron', () => {
      expect(repeatValueToRecurrence('EVERY_6_HOURS')).toEqual({
        type: 'CUSTOM',
        cronExpression: '0 */6 * * *',
      });
      expect(repeatValueToRecurrence('EVERY_12_HOURS').cronExpression).toBe('0 */12 * * *');
      expect(repeatValueToRecurrence('EVERY_2_DAYS').cronExpression).toBe('0 9 */2 * *');
    });

    it('defaults unknown/empty repeat to ONCE', () => {
      expect(repeatValueToRecurrence(undefined)).toEqual({ type: 'ONCE' });
      expect(repeatValueToRecurrence('NONSENSE')).toEqual({ type: 'ONCE' });
    });

    it('recurrenceToRepeatValue round-trips both simple and interval repeats', () => {
      expect(recurrenceToRepeatValue({ type: 'ONCE' })).toBe('ONCE');
      expect(recurrenceToRepeatValue(undefined)).toBe('ONCE');
      expect(recurrenceToRepeatValue({ type: 'DAILY' })).toBe('DAILY');
      expect(recurrenceToRepeatValue({ type: 'CUSTOM', cronExpression: '0 */6 * * *' })).toBe(
        'EVERY_6_HOURS'
      );
      // CUSTOM without a recognised cron resolves to the generic Custom option.
      expect(recurrenceToRepeatValue({ type: 'CUSTOM', cronExpression: 'weird' })).toBe('CUSTOM');
    });

    it('exposes the canonical repeat options', () => {
      expect(TASK_REPEAT_OPTIONS.map((o) => o.value)).toEqual([
        'ONCE',
        'EVERY_6_HOURS',
        'EVERY_12_HOURS',
        'DAILY',
        'EVERY_2_DAYS',
        'WEEKLY',
        'CUSTOM',
      ]);
    });
  });
});
