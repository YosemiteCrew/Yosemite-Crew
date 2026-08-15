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
 * These tests drive the REAL preferred-zone storage rather than mocking
 * getPreferredTimeZone. Mocking it does not work here: the module's own
 * formatters close over the real function, so a `requireActual` spread leaves
 * them reading the true zone and the test silently checks nothing.
 */
import {
  buildPreferredTimeZoneDayInstant,
  formatDateInPreferredTimeZone,
  getPreferredTimeZone,
  setPreferredTimeZone,
} from '@/app/lib/timezone';

/** The label InpatientSchedule renders, with the anchoring applied. */
const dayLabel = (picked: Date) =>
  formatDateInPreferredTimeZone(
    buildPreferredTimeZoneDayInstant(picked.getFullYear(), picked.getMonth() + 1, picked.getDate()),
    { day: 'numeric', month: 'short', year: 'numeric' }
  );

/** Formatting the picked instant directly, i.e. the behaviour before the fix. */
const naiveLabel = (picked: Date) =>
  formatDateInPreferredTimeZone(picked, { day: 'numeric', month: 'short', year: 'numeric' });

describe('preferred-time-zone calendar day anchoring', () => {
  beforeEach(() => globalThis.localStorage?.clear());

  it.each([
    'America/Los_Angeles',
    'America/New_York',
    'UTC',
    'Europe/Berlin',
    'Asia/Kolkata',
    'Pacific/Auckland',
  ])('keeps the picked day intact in %s', (zone) => {
    expect(setPreferredTimeZone(zone)).toBe(true);
    expect(getPreferredTimeZone()).toBe(zone);

    // A browser-local midnight, the shape the date picker produces.
    const picked = new Date(2026, 7, 15, 0, 0, 0, 0);
    expect(dayLabel(picked)).toBe('Aug 15, 2026');
  });

  it('anchors a day that the naive formatting would have slipped', () => {
    // The test process runs at TZ=Europe/Berlin (see the npm test script), so a
    // local midnight is 22:00Z the previous day and lands on the 14th in
    // Los Angeles. This is the reviewer's exact scenario.
    expect(setPreferredTimeZone('America/Los_Angeles')).toBe(true);
    const picked = new Date(2026, 7, 15, 0, 0, 0, 0);

    const naive = naiveLabel(picked);
    const anchored = dayLabel(picked);

    expect(anchored).toBe('Aug 15, 2026');
    // Assert the bug is genuinely reachable, so this test fails loudly if the
    // anchoring is ever removed rather than passing vacuously.
    if (picked.getTime() < Date.UTC(2026, 7, 15)) {
      expect(naive).toBe('Aug 14, 2026');
      expect(anchored).not.toBe(naive);
    }
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
    expect(picker).toContain('Jun 24');
    expect(header).toContain('Jun 24');
    expect(picker).toContain('6:00');
    expect(header).toContain('6:00');
  });
});
