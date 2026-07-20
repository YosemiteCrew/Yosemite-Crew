import {
  addCalendarDays,
  buildTabletToolbarTitle,
  getDayRangeLabel,
  getPagerStepDays,
  getWeekRangeLabel,
} from '@/app/features/appointments/components/Calendar/responsive/tabletToolbarModel';

describe('tabletToolbarModel', () => {
  describe('addCalendarDays', () => {
    it('shifts forward without mutating the input', () => {
      const start = new Date(2026, 6, 6);
      const shifted = addCalendarDays(start, 6);

      expect(shifted.getDate()).toBe(12);
      expect(start.getDate()).toBe(6);
    });

    it('rolls across a month boundary', () => {
      expect(addCalendarDays(new Date(2026, 5, 29), 6).getMonth()).toBe(6);
    });
  });

  describe('getWeekRangeLabel', () => {
    it('names the month once when the week sits inside one month', () => {
      expect(getWeekRangeLabel(new Date(2026, 6, 6))).toBe('6 – 12 Jul');
    });

    it('names both months when the week straddles two', () => {
      expect(getWeekRangeLabel(new Date(2026, 5, 29))).toBe('29 Jun – 5 Jul');
    });
  });

  describe('getDayRangeLabel', () => {
    it('renders weekday, day and short month', () => {
      expect(getDayRangeLabel(new Date(2026, 6, 7))).toBe('Tue 7 Jul');
    });
  });

  describe('getPagerStepDays', () => {
    it('steps a whole week in the week view', () => {
      expect(getPagerStepDays('week')).toBe(7);
    });

    it.each(['day', 'team'])('steps a single day in the %s view', (view) => {
      expect(getPagerStepDays(view)).toBe(1);
    });
  });

  describe('buildTabletToolbarTitle', () => {
    const weekStart = new Date(2026, 6, 6);
    const currentDate = new Date(2026, 6, 7);

    it('names the ISO week and the count in the week view', () => {
      expect(
        buildTabletToolbarTitle({
          activeCalendar: 'week',
          currentDate,
          weekStart,
          appointmentCount: 41,
        })
      ).toEqual({ title: 'Week 28', countLabel: '(41 appointments)' });
    });

    it('names the day in the day and team views', () => {
      expect(
        buildTabletToolbarTitle({
          activeCalendar: 'team',
          currentDate,
          weekStart,
          appointmentCount: 14,
        })
      ).toEqual({ title: 'Tue 7 Jul', countLabel: '(14 appointments)' });
    });

    it('singularises a lone appointment', () => {
      expect(
        buildTabletToolbarTitle({
          activeCalendar: 'week',
          currentDate,
          weekStart,
          appointmentCount: 1,
        }).countLabel
      ).toBe('(1 appointment)');
    });

    it('drops the count entirely when the period is empty', () => {
      expect(
        buildTabletToolbarTitle({
          activeCalendar: 'week',
          currentDate,
          weekStart,
          appointmentCount: 0,
        }).countLabel
      ).toBe('');
    });
  });
});
