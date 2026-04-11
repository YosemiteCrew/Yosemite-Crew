import {
  formatHourLabel,
  formatMinuteLabel,
  getCalendarColumnGridStyle,
  getHourRowHeightPx,
  getPixelsPerStepForZoom,
} from '@/app/features/appointments/components/Calendar/calendarLayout';

describe('calendarLayout helpers', () => {
  it('returns row heights per zoom mode', () => {
    expect(getHourRowHeightPx('in')).toBe(180);
    expect(getHourRowHeightPx('out')).toBe(34);
  });

  it('returns pixels per step for each zoom mode', () => {
    expect(getPixelsPerStepForZoom('in')).toBeGreaterThan(getPixelsPerStepForZoom('out'));
    expect(getPixelsPerStepForZoom('out')).toBeGreaterThan(0);
  });

  it('builds safe grid style with minimum 1 column', () => {
    expect(getCalendarColumnGridStyle(0, 240)).toEqual({
      gridTemplateColumns: 'repeat(1, minmax(240px, 1fr))',
      width: 'max(100%, 240px)',
    });

    expect(getCalendarColumnGridStyle(3, 200)).toEqual({
      gridTemplateColumns: 'repeat(3, minmax(200px, 1fr))',
      width: 'max(100%, 600px)',
    });
  });

  it('formats hour labels correctly with normalization', () => {
    expect(formatHourLabel(0)).toBe('12:00 AM');
    expect(formatHourLabel(12)).toBe('12:00 PM');
    expect(formatHourLabel(13)).toBe('1:00 PM');
    expect(formatHourLabel(-1)).toBe('11:00 PM');
    expect(formatHourLabel(25)).toBe('1:00 AM');
  });

  it('formats minute labels correctly with wraparound', () => {
    expect(formatMinuteLabel(0)).toBe('12:00 AM');
    expect(formatMinuteLabel(75)).toBe('1:15 AM');
    expect(formatMinuteLabel(12 * 60)).toBe('12:00 PM');
    expect(formatMinuteLabel(-1)).toBe('11:59 PM');
    expect(formatMinuteLabel(24 * 60 + 30)).toBe('12:30 AM');
  });
});
