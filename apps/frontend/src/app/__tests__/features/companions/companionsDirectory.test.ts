import {
  SPECIES_TABS,
  getActiveCount,
  getAvatarPalette,
  getCompanionRowStatusColor,
  getInClinicStatusMeta,
  getLastVisit,
  getLastVisitStart,
  getMonogram,
  getSpeciesCounts,
  getTodaysAppointments,
  hasCoParent,
  isToday,
  sortByLastVisit,
} from '@/app/features/companions/pages/Companions/companionsDirectory';

const companion = (overrides: Record<string, unknown> = {}): any => ({
  companion: { id: 'c1', name: 'Poppy', type: 'dog', status: 'active', ...overrides },
  parent: { firstName: 'Lena', lastName: 'Hartmann' },
});

const appt = (overrides: Record<string, unknown> = {}): any => ({
  id: 'a1',
  status: 'UPCOMING',
  startTime: new Date(),
  appointmentDate: new Date(),
  companion: { id: 'c1', name: 'Poppy' },
  concern: 'dental',
  ...overrides,
});

describe('companionsDirectory helpers', () => {
  it('cycles avatar palettes deterministically and falls back for empty seed', () => {
    expect(getAvatarPalette('c1')).toEqual(getAvatarPalette('c1'));
    expect(getAvatarPalette('').bg).toContain('avatar-green');
    expect(getAvatarPalette(undefined).ink).toContain('avatar-green');
    // Different seeds can land on different palettes.
    const palettes = new Set(['a', 'bb', 'ccc', 'dddd'].map((s) => getAvatarPalette(s).bg));
    expect(palettes.size).toBeGreaterThan(1);
  });

  it('builds a monogram from the first letter, or ? when empty', () => {
    expect(getMonogram('poppy')).toBe('P');
    expect(getMonogram('  ')).toBe('?');
    expect(getMonogram(undefined)).toBe('?');
  });

  it('counts species with exotics as the non dog/cat/horse bucket', () => {
    const counts = getSpeciesCounts([
      companion({ type: 'dog' }),
      companion({ type: 'cat' }),
      companion({ type: 'horse' }),
      companion({ type: 'rabbit' }),
      companion({ type: undefined }),
    ]);
    expect(counts).toEqual({ all: 5, dog: 1, cat: 1, horse: 1, other: 2 });
  });

  it('counts active companions', () => {
    expect(
      getActiveCount([
        companion({ status: 'active' }),
        companion({ status: 'inactive' }),
        companion({ status: undefined }),
      ])
    ).toBe(1);
  });

  it('exposes the ordered species tab config', () => {
    expect(SPECIES_TABS.map((tab) => tab.label)).toEqual([
      'All',
      'Dogs',
      'Cats',
      'Horses',
      'Exotics',
    ]);
  });

  it('returns todays appointments, soonest first, excluding cancelled and capped', () => {
    const now = new Date('2026-07-14T12:00:00.000Z');
    const today = (hh: number) => new Date(`2026-07-14T${String(hh).padStart(2, '0')}:00:00.000Z`);
    const result = getTodaysAppointments(
      [
        appt({ id: 'late', startTime: today(15) }),
        appt({ id: 'early', startTime: today(8) }),
        appt({ id: 'cancelled', status: 'CANCELLED', startTime: today(9) }),
        appt({ id: 'noshow', status: 'NO_SHOW', startTime: today(9) }),
        appt({ id: 'yesterday', startTime: new Date('2026-07-13T09:00:00.000Z') }),
        appt({ id: 'mid1', startTime: today(10) }),
        appt({ id: 'mid2', startTime: today(11) }),
      ],
      now
    );
    expect(result.map((a) => a.id)).toEqual(['early', 'mid1', 'mid2', 'late']);
  });

  it('falls back to appointmentDate when startTime is missing', () => {
    const now = new Date('2026-07-14T12:00:00.000Z');
    const result = getTodaysAppointments(
      [appt({ id: 'nostart', startTime: undefined, appointmentDate: now })],
      now
    );
    expect(result).toHaveLength(1);
  });

  it('maps each appointment status to a band badge', () => {
    expect(getInClinicStatusMeta('IN_PROGRESS').label).toBe('In progress');
    expect(getInClinicStatusMeta('CHECKED_IN').label).toBe('Checked in');
    expect(getInClinicStatusMeta('UPCOMING').label).toBe('Arriving');
    expect(getInClinicStatusMeta('REQUESTED').label).toBe('Booked');
    expect(getInClinicStatusMeta(undefined).label).toBe('Booked');
  });

  it('finds the most recent past visit for a companion', () => {
    const now = new Date('2026-07-14T12:00:00.000Z');
    const appts = [
      appt({ id: 'old', startTime: new Date('2026-01-01T09:00:00.000Z') }),
      appt({ id: 'recent', startTime: new Date('2026-06-01T09:00:00.000Z') }),
      appt({ id: 'future', startTime: new Date('2999-01-01T09:00:00.000Z') }),
      appt({ id: 'other-pet', companion: { id: 'zz' }, startTime: now }),
    ];
    expect(getLastVisit(appts, 'c1', now)?.id).toBe('recent');
    expect(getLastVisitStart(appts, 'c1', now)?.toISOString()).toBe('2026-06-01T09:00:00.000Z');
    expect(getLastVisit(appts, undefined, now)).toBeNull();
    expect(getLastVisit([], 'c1', now)).toBeNull();
    expect(getLastVisitStart([], 'c1', now)).toBeNull();
  });

  it('colors the row status ink by record status', () => {
    expect(getCompanionRowStatusColor('active')).toContain('status-completed');
    expect(getCompanionRowStatusColor('archived')).toContain('status-upcoming');
    expect(getCompanionRowStatusColor('inactive')).toContain('ink-faint');
    expect(getCompanionRowStatusColor(undefined)).toContain('ink-faint');
  });

  it('detects a live co-parent link only', () => {
    expect(hasCoParent(companion())).toBe(false);
    expect(
      hasCoParent(companion({ parentLinks: [{ role: 'PRIMARY', status: 'ACTIVE' }] }))
    ).toBe(false);
    expect(
      hasCoParent(companion({ parentLinks: [{ role: 'CO_PARENT', status: 'ACTIVE' }] }))
    ).toBe(true);
    expect(
      hasCoParent(companion({ parentLinks: [{ role: 'CO_PARENT', status: 'REVOKED' }] }))
    ).toBe(false);
  });

  it('recognises today vs other/invalid dates', () => {
    const now = new Date('2026-07-14T12:00:00.000Z');
    expect(isToday(new Date('2026-07-14T20:00:00.000Z'), now)).toBe(true);
    expect(isToday(new Date('2026-07-13T20:00:00.000Z'), now)).toBe(false);
    expect(isToday(undefined, now)).toBe(false);
    expect(isToday('not-a-date', now)).toBe(false);
  });

  it('sorts companions by most recent visit, placing visitless last', () => {
    const now = new Date('2026-07-14T12:00:00.000Z');
    const a = companion({ id: 'a' });
    const b = companion({ id: 'b' });
    const c = companion({ id: 'c' });
    const appts = [
      appt({ companion: { id: 'a' }, startTime: new Date('2026-01-01T09:00:00.000Z') }),
      appt({ companion: { id: 'b' }, startTime: new Date('2026-06-01T09:00:00.000Z') }),
    ];
    const sorted = sortByLastVisit([a, b, c], appts, now);
    expect(sorted.map((item) => item.companion.id)).toEqual(['b', 'a', 'c']);
  });
});
