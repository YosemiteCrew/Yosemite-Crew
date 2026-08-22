import {
  formatAppointmentTime,
  getTimeUntilChatActivation,
  isChatActive,
} from '../../../src/shared/services/chatTiming';

// Every helper reads `new Date()`, so the window assertions are only meaningful
// with the clock pinned. Fixed at a UTC noon so the local-time formatting below
// cannot straddle a date boundary in the runner's timezone.
const NOW = new Date('2026-08-22T12:00:00Z');

describe('chatTiming', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    jest.useRealTimers();
  });

  describe('isChatActive', () => {
    // The guard exists because an unparseable timestamp would otherwise compare
    // NaN dates and silently report chat as locked forever.
    it('returns false and warns when the timestamp cannot be parsed', () => {
      expect(isChatActive('not-a-timestamp')).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        '[ChatTiming] Invalid appointment time:',
        'not-a-timestamp',
      );
    });

    it('is active inside the window, from activation until 30 minutes after', () => {
      // appointment in 4 minutes, default 5 minute activation -> already open
      expect(isChatActive('2026-08-22T12:04:00Z')).toBe(true);
      // appointment 29 minutes ago -> still inside the +30 minute tail
      expect(isChatActive('2026-08-22T11:31:00Z')).toBe(true);
    });

    it('is inactive before activation and after the window closes', () => {
      // appointment in 6 minutes, activation is 5 minutes before -> not yet
      expect(isChatActive('2026-08-22T12:06:00Z')).toBe(false);
      // appointment 31 minutes ago -> window closed
      expect(isChatActive('2026-08-22T11:29:00Z')).toBe(false);
    });

    it('honours a custom activation window', () => {
      // 30 minutes out is closed at the default 5, open at 60
      expect(isChatActive('2026-08-22T12:30:00Z')).toBe(false);
      expect(isChatActive('2026-08-22T12:30:00Z', 60)).toBe(true);
    });

    // The helper appends `Z` when absent, so a bare timestamp must be read as
    // UTC rather than drifting with the runner's timezone.
    it('treats a timestamp without a Z suffix as UTC', () => {
      expect(isChatActive('2026-08-22T12:04:00')).toBe(
        isChatActive('2026-08-22T12:04:00Z'),
      );
    });
  });

  describe('formatAppointmentTime', () => {
    it('returns the input unchanged and warns when it cannot be parsed', () => {
      expect(formatAppointmentTime('nonsense')).toBe('nonsense');
      expect(warnSpy).toHaveBeenCalledWith(
        '[ChatTiming] Invalid appointment time for formatting:',
        'nonsense',
      );
    });

    it('labels a same-day appointment as Today', () => {
      expect(formatAppointmentTime('2026-08-22T15:30:00Z')).toMatch(
        /^Today at /,
      );
    });

    it('spells out the date for an appointment on another day', () => {
      const formatted = formatAppointmentTime('2026-09-01T15:30:00Z');
      expect(formatted).not.toMatch(/^Today at /);
      expect(formatted).toMatch(/ at /);
    });

    it('treats a timestamp without a Z suffix as UTC', () => {
      expect(formatAppointmentTime('2026-08-22T15:30:00')).toBe(
        formatAppointmentTime('2026-08-22T15:30:00Z'),
      );
    });
  });

  describe('getTimeUntilChatActivation', () => {
    it('returns null and warns when the timestamp cannot be parsed', () => {
      expect(getTimeUntilChatActivation('¯\\_(ツ)_/¯')).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        '[ChatTiming] Invalid appointment time for countdown:',
        '¯\\_(ツ)_/¯',
      );
    });

    it('returns null once activation has already been reached', () => {
      // appointment in 4 minutes with a 5 minute activation -> already unlocked
      expect(getTimeUntilChatActivation('2026-08-22T12:04:00Z')).toBeNull();
    });

    // The hours split exists because a flat minute count read as "unlocks in
    // 1439m" for a next-day appointment.
    it('splits the remainder into hours, minutes and seconds', () => {
      // activation is 5 minutes before, so 2h 5m 30s out -> 2h 0m 30s remaining
      expect(getTimeUntilChatActivation('2026-08-22T14:05:30Z')).toEqual({
        hours: 2,
        minutes: 0,
        seconds: 30,
      });
    });

    it('keeps minutes as the remainder rather than the total', () => {
      // 1 day and 5 minutes out -> 24h remaining, not 1445 minutes
      const result = getTimeUntilChatActivation('2026-08-23T12:05:00Z');
      expect(result).toEqual({hours: 24, minutes: 0, seconds: 0});
      expect(result?.minutes).toBeLessThan(60);
    });

    it('honours a custom activation window', () => {
      // 30 minutes out: already unlocked at 60, still counting down at 5
      expect(getTimeUntilChatActivation('2026-08-22T12:30:00Z', 60)).toBeNull();
      expect(getTimeUntilChatActivation('2026-08-22T12:30:00Z', 5)).toEqual({
        hours: 0,
        minutes: 25,
        seconds: 0,
      });
    });
  });
});
