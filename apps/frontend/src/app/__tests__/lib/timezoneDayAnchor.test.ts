/**
 * Calendar-day labels must not slip a day when the org's preferred time zone
 * differs from the browser's.
 *
 * A date picked in the UI is a BROWSER-LOCAL midnight. Formatting that instant
 * directly in a westward preferred zone renders the previous calendar day, so a
 * header reads "Aug 14" while the list below filters Aug 15. Anchoring the
 * picked calendar day at noon in the preferred zone first removes the problem:
 * noon sits far enough from either boundary that no UTC offset and no DST shift
 * can move it onto a neighbouring date.
 *
 * Two deliberate choices here:
 *
 * 1. These drive the REAL preferred-zone storage rather than mocking
 *    getPreferredTimeZone. Mocking does not work: the module's own formatters
 *    close over the real function, so a `requireActual` spread leaves them
 *    reading the true zone and the test silently checks nothing.
 *
 * 2. Nothing depends on the runner's own time zone. The suite sets no TZ, so an
 *    assertion written around a browser-local midnight only distinguishes the
 *    anchored and naive paths on a machine east of the preferred zone - it goes
 *    vacuous on a UTC runner. The divergence is proved with an explicitly
 *    constructed UTC instant instead.
 */
import {
  buildPreferredTimeZoneDayInstant,
  formatDateInPreferredTimeZone,
  getPreferredTimeZone,
  setPreferredTimeZone,
} from '@/app/lib/timezone';

const DAY_FORMAT: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};

/** The label InpatientSchedule renders, with the anchoring applied. */
const dayLabel = (picked: Date) =>
  formatDateInPreferredTimeZone(
    buildPreferredTimeZoneDayInstant(picked.getFullYear(), picked.getMonth() + 1, picked.getDate()),
    DAY_FORMAT
  );

/** Formatting an instant directly, i.e. the behaviour before the fix. */
const naiveLabel = (instant: Date) => formatDateInPreferredTimeZone(instant, DAY_FORMAT);

describe('preferred-time-zone calendar day anchoring', () => {
  beforeEach(() => globalThis.localStorage?.clear());

  it.each([
    'America/Los_Angeles',
    'America/New_York',
    'UTC',
    'Europe/Berlin',
    'Asia/Kolkata',
    'Pacific/Auckland',
  ])('keeps the picked day intact in %s, whatever the runner zone is', (zone) => {
    expect(setPreferredTimeZone(zone)).toBe(true);
    expect(getPreferredTimeZone()).toBe(zone);

    // A browser-local midnight, the shape the date picker produces.
    const picked = new Date(2026, 7, 15, 0, 0, 0, 0);
    expect(dayLabel(picked)).toBe('Aug 15, 2026');
  });

  it('proves an unanchored instant slips a day in a westward zone', () => {
    expect(setPreferredTimeZone('America/Los_Angeles')).toBe(true);

    // 15 Aug 02:00 UTC is still 14 Aug in Los Angeles (UTC-7), and this instant
    // is constructed in UTC, so the claim holds on every runner. This is the
    // shape of the bug: format the raw instant and the header shows the wrong
    // day while the list filters the right one.
    const instant = new Date(Date.UTC(2026, 7, 15, 2, 0, 0));
    expect(naiveLabel(instant)).toBe('Aug 14, 2026');

    // Anchoring the same calendar day at noon in the preferred zone lands on
    // the intended date.
    expect(
      formatDateInPreferredTimeZone(buildPreferredTimeZoneDayInstant(2026, 8, 15), DAY_FORMAT)
    ).toBe('Aug 15, 2026');
  });

  it('proves an unanchored instant slips forward in a far-east zone', () => {
    expect(setPreferredTimeZone('Pacific/Auckland')).toBe(true);

    // 15 Aug 22:00 UTC is already 16 Aug in Auckland (UTC+12).
    const instant = new Date(Date.UTC(2026, 7, 15, 22, 0, 0));
    expect(naiveLabel(instant)).toBe('Aug 16, 2026');

    expect(
      formatDateInPreferredTimeZone(buildPreferredTimeZoneDayInstant(2026, 8, 15), DAY_FORMAT)
    ).toBe('Aug 15, 2026');
  });

  it('survives a spring-forward DST transition', () => {
    expect(setPreferredTimeZone('America/New_York')).toBe(true);
    // 8 Mar 2026 is a US spring-forward date; 02:00 local does not exist.
    expect(dayLabel(new Date(2026, 2, 8, 0, 0, 0, 0))).toBe('Mar 8, 2026');
  });

  it('survives an autumn fall-back DST transition', () => {
    expect(setPreferredTimeZone('America/New_York')).toBe(true);
    // 1 Nov 2026 is a US fall-back date; 01:00 local happens twice.
    expect(dayLabel(new Date(2026, 10, 1, 0, 0, 0, 0))).toBe('Nov 1, 2026');
  });

  it('handles a month boundary in a far-east zone', () => {
    expect(setPreferredTimeZone('Pacific/Auckland')).toBe(true);
    expect(dayLabel(new Date(2026, 7, 31, 0, 0, 0, 0))).toBe('Aug 31, 2026');
  });
});

describe('chat surfaces agree on one clock', () => {
  beforeEach(() => globalThis.localStorage?.clear());

  it('formats the same appointment instant identically wherever it is rendered', () => {
    expect(setPreferredTimeZone('America/Los_Angeles')).toBe(true);
    const startTime = '2026-06-25T01:00:00Z';

    // The share picker (ShareEntityModal) forced UTC and the thread header
    // (ChatHeaderContext) used the browser locale, so the same appointment
    // showed two different days. Both now route through one formatter.
    const picker = formatDateInPreferredTimeZone(new Date(startTime), {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    const header = formatDateInPreferredTimeZone(new Date(startTime), {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    // 01:00Z is the previous evening in Los Angeles: both must say Jun 24, 6 PM.
    // The instant is absolute, so this holds on any runner.
    expect(picker).toContain('Jun 24');
    expect(header).toContain('Jun 24');
    expect(picker).toContain('6:00');
    expect(header).toContain('6:00');
  });
});
