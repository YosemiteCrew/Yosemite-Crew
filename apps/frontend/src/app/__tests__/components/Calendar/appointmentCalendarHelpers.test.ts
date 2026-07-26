import { Appointment } from '@yosemite-crew/types';
import { Team } from '@/app/features/organization/types/team';
import { Slot } from '@/app/features/appointments/types/appointments';

jest.mock('@/app/lib/timezone', () => ({
  buildDateInPreferredTimeZone: (date: Date, minuteOfDay: number) =>
    new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) + minuteOfDay * 60_000
    ),
  formatDateInPreferredTimeZone: (date: Date, options: Intl.DateTimeFormatOptions) =>
    options.weekday
      ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
          date.getUTCDay()
        ]
      : date.toISOString().slice(0, 10),
  utcClockTimeToPreferredTimeZoneClock: (value: string) => {
    const [hours, minutes] = value.split(':').map(Number);
    return { minutes: (hours % 24) * 60 + minutes, dayOffset: hours >= 24 ? 1 : 0 };
  },
}));

jest.mock('@/app/features/appointments/components/Calendar/availabilityIntervals', () => ({
  resolveAvailabilityIntervalsForDay: jest.fn(() => [{ startMinute: 540, endMinute: 1020 }]),
}));

import {
  INITIAL_DRAG_UI,
  snapToStep,
  clampMinutes,
  toLocalDayKey,
  getDayOfWeekKey,
  toLocalClockFromUtcTime,
  getErrorMessageFromCandidate,
  hasAppointmentConflict,
  normalizeId,
  resolvePractitionerId,
  findCurrentUserPractitionerId,
  supportsSpeciality,
  buildAppointmentStartFromCalendarMinutes,
  collectValidMinutesForSlot,
  resolveViewAvailabilityIntervals,
  buildDropIntervalsFromStarts,
} from '@/app/features/appointments/components/Calendar/appointmentCalendarHelpers';
import { resolveAvailabilityIntervalsForDay } from '@/app/features/appointments/components/Calendar/availabilityIntervals';

const resolveIntervalsMock = resolveAvailabilityIntervalsForDay as jest.Mock;

const makeAppointment = (overrides: Partial<Appointment> = {}): Appointment =>
  ({
    id: 'appt-1',
    status: 'CONFIRMED',
    startTime: '2026-03-02T09:00:00.000Z',
    endTime: '2026-03-02T09:30:00.000Z',
    ...overrides,
  }) as unknown as Appointment;

const makeTeam = (overrides: Record<string, unknown> = {}): Team =>
  ({ _id: 'team-1', practionerId: 'prac-1', ...overrides }) as unknown as Team;

describe('appointmentCalendarHelpers', () => {
  describe('INITIAL_DRAG_UI', () => {
    it('starts with every drag field cleared', () => {
      expect(INITIAL_DRAG_UI).toEqual({
        draggedAppointmentId: null,
        draggedAppointmentLabel: null,
        dragError: null,
        dragContext: null,
      });
    });
  });

  describe('snapToStep', () => {
    it('rounds to the nearest default 5-minute step', () => {
      expect(snapToStep(12)).toBe(10);
      expect(snapToStep(13)).toBe(15);
    });

    it('honours a custom step', () => {
      expect(snapToStep(50, 15)).toBe(45);
    });
  });

  describe('clampMinutes', () => {
    it('snaps values inside the day', () => {
      expect(clampMinutes(123)).toBe(125);
    });

    it('clamps below zero up to zero', () => {
      expect(clampMinutes(-40)).toBe(0);
    });

    it('clamps past midnight down to the last slot', () => {
      expect(clampMinutes(24 * 60 + 30)).toBe(24 * 60 - 5);
    });
  });

  describe('toLocalDayKey / getDayOfWeekKey', () => {
    it('formats a date key', () => {
      expect(toLocalDayKey(new Date('2026-03-02T10:00:00.000Z'))).toBe('2026-03-02');
    });

    it('uppercases the weekday', () => {
      expect(getDayOfWeekKey(new Date('2026-03-02T10:00:00.000Z'))).toBe('MONDAY');
    });
  });

  describe('toLocalClockFromUtcTime', () => {
    it('delegates to the preferred-timezone converter', () => {
      expect(toLocalClockFromUtcTime('09:30')).toEqual({ minutes: 570, dayOffset: 0 });
    });
  });

  describe('getErrorMessageFromCandidate', () => {
    it('prefers response.data.message', () => {
      const candidate = { response: { data: { message: ' boom ', error: 'other' } } };
      expect(getErrorMessageFromCandidate(candidate, 'fallback')).toBe('boom');
    });

    it('falls back to response.data.error', () => {
      const candidate = { response: { data: { error: 'bad request' } } };
      expect(getErrorMessageFromCandidate(candidate, 'fallback')).toBe('bad request');
    });

    it('falls back to response.data.details', () => {
      const candidate = { response: { data: { details: 'details here' } } };
      expect(getErrorMessageFromCandidate(candidate, 'fallback')).toBe('details here');
    });

    it('accepts a plain string response body', () => {
      const candidate = { response: { data: 'raw failure' } };
      expect(getErrorMessageFromCandidate(candidate, 'fallback')).toBe('raw failure');
    });

    it('uses the top-level message when no response data is present', () => {
      expect(getErrorMessageFromCandidate({ message: 'top level' }, 'fallback')).toBe('top level');
    });

    it('returns the fallback for blank and unusable candidates', () => {
      expect(getErrorMessageFromCandidate({ message: '   ' }, 'fallback')).toBe('fallback');
      expect(getErrorMessageFromCandidate({ response: { data: {} } }, 'fallback')).toBe('fallback');
      expect(getErrorMessageFromCandidate({}, 'fallback')).toBe('fallback');
    });
  });

  describe('hasAppointmentConflict', () => {
    const moved = makeAppointment({ id: 'moved' } as Partial<Appointment>);
    const nextStart = new Date('2026-03-02T09:00:00.000Z');
    const nextEnd = new Date('2026-03-02T09:30:00.000Z');

    it('ignores the appointment being moved and entries without an id', () => {
      const existing = [
        makeAppointment({ id: 'moved' } as Partial<Appointment>),
        makeAppointment({ id: undefined } as Partial<Appointment>),
      ];
      expect(hasAppointmentConflict(moved, nextStart, nextEnd, existing)).toBe(false);
    });

    it('ignores cancelled and no-show appointments', () => {
      const existing = [
        makeAppointment({ id: 'a', status: 'CANCELLED', lead: { id: 'vet-1' } } as never),
        makeAppointment({ id: 'b', status: 'NO_SHOW', lead: { id: 'vet-1' } } as never),
      ];
      expect(
        hasAppointmentConflict(
          makeAppointment({ id: 'moved', lead: { id: 'vet-1' } } as never),
          nextStart,
          nextEnd,
          existing
        )
      ).toBe(false);
    });

    it('ignores non-overlapping appointments', () => {
      const existing = [
        makeAppointment({
          id: 'a',
          startTime: '2026-03-02T11:00:00.000Z',
          endTime: '2026-03-02T11:30:00.000Z',
          lead: { id: 'vet-1' },
        } as never),
      ];
      expect(
        hasAppointmentConflict(
          makeAppointment({ id: 'moved', lead: { id: 'vet-1' } } as never),
          nextStart,
          nextEnd,
          existing
        )
      ).toBe(false);
    });

    it('detects a lead conflict using the target practitioner override', () => {
      const existing = [makeAppointment({ id: 'a', lead: { id: 'vet-2' } } as never)];
      expect(hasAppointmentConflict(moved, nextStart, nextEnd, existing, 'vet-2')).toBe(true);
    });

    it('detects a lead conflict from the moved appointment itself', () => {
      const existing = [makeAppointment({ id: 'a', lead: { id: 'vet-3' } } as never)];
      expect(
        hasAppointmentConflict(
          makeAppointment({ id: 'moved', lead: { id: 'vet-3' } } as never),
          nextStart,
          nextEnd,
          existing
        )
      ).toBe(true);
    });

    it('detects a room conflict', () => {
      const existing = [makeAppointment({ id: 'a', room: { id: 'room-1' } } as never)];
      expect(
        hasAppointmentConflict(
          makeAppointment({ id: 'moved', room: { id: 'room-1' } } as never),
          nextStart,
          nextEnd,
          existing
        )
      ).toBe(true);
    });

    it('reports no conflict when neither lead nor room match', () => {
      const existing = [
        makeAppointment({ id: 'a', lead: { id: 'vet-9' }, room: { id: 'room-9' } } as never),
      ];
      expect(
        hasAppointmentConflict(
          makeAppointment({ id: 'moved', lead: { id: 'vet-1' }, room: { id: 'room-1' } } as never),
          nextStart,
          nextEnd,
          existing
        )
      ).toBe(false);
    });
  });

  describe('normalizeId', () => {
    it('takes the last path segment, trimmed and lowercased', () => {
      expect(normalizeId('  Practitioner/ABC-123 ')).toBe('abc-123');
    });

    it('returns an empty string for missing values', () => {
      expect(normalizeId()).toBe('');
      expect(normalizeId(undefined)).toBe('');
    });
  });

  describe('resolvePractitionerId', () => {
    const teams = [makeTeam({ _id: 'team-1', practionerId: 'PRAC-1' })];

    it('returns undefined without a candidate', () => {
      expect(resolvePractitionerId(teams)).toBeUndefined();
    });

    it('resolves through the practitioner id', () => {
      expect(resolvePractitionerId(teams, 'prac-1')).toBe('PRAC-1');
    });

    it('resolves through the team _id', () => {
      expect(resolvePractitionerId(teams, 'Practitioner/team-1')).toBe('PRAC-1');
    });

    it('falls back to the candidate when nothing matches', () => {
      expect(resolvePractitionerId(teams, 'unknown')).toBe('unknown');
    });

    it('falls back to the candidate when the match has no practitioner id', () => {
      const withoutPractitioner = [makeTeam({ _id: 'team-2', practionerId: '' })];
      expect(resolvePractitionerId(withoutPractitioner, 'team-2')).toBe('team-2');
    });
  });

  describe('findCurrentUserPractitionerId', () => {
    it('returns undefined for a blank auth user', () => {
      expect(findCurrentUserPractitionerId([makeTeam()], '')).toBeUndefined();
    });

    it('matches on practionerId', () => {
      expect(findCurrentUserPractitionerId([makeTeam({ practionerId: 'PRAC-7' })], 'prac-7')).toBe(
        'PRAC-7'
      );
    });

    it('matches on nested userOrganisation.userId and falls back to _id', () => {
      const teams = [
        makeTeam({
          _id: 'team-9',
          practionerId: '',
          userOrganisation: { userId: 'user-9' },
        }),
      ];
      expect(findCurrentUserPractitionerId(teams, 'user-9')).toBe('team-9');
    });

    it('matches on the flat userId and id aliases', () => {
      expect(
        findCurrentUserPractitionerId([makeTeam({ practionerId: 'P1', userId: 'u-1' })], 'u-1')
      ).toBe('P1');
      expect(
        findCurrentUserPractitionerId([makeTeam({ practionerId: 'P2', id: 'i-2' })], 'i-2')
      ).toBe('P2');
    });

    it('returns undefined when no team matches', () => {
      expect(findCurrentUserPractitionerId([makeTeam()], 'nobody')).toBeUndefined();
    });
  });

  describe('supportsSpeciality', () => {
    it('returns false when the target lead is not on the team', () => {
      expect(supportsSpeciality([makeTeam()], 'missing', makeAppointment())).toBe(false);
    });

    it('allows an appointment with no speciality', () => {
      expect(supportsSpeciality([makeTeam()], 'prac-1', makeAppointment())).toBe(true);
    });

    it('allows a target with no speciality list', () => {
      const appointment = makeAppointment({
        appointmentType: { speciality: { id: 'sp-1', name: 'Dentistry' } },
      } as never);
      expect(supportsSpeciality([makeTeam({ speciality: [] })], 'prac-1', appointment)).toBe(true);
      expect(supportsSpeciality([makeTeam()], 'prac-1', appointment)).toBe(true);
    });

    it('matches a speciality by id', () => {
      const appointment = makeAppointment({
        appointmentType: { speciality: { id: 'SP-1' } },
      } as never);
      const teams = [makeTeam({ speciality: [{ _id: 'sp-1' }] })];
      expect(supportsSpeciality(teams, 'prac-1', appointment)).toBe(true);
    });

    it('matches a speciality by name, including bare string entries', () => {
      const appointment = makeAppointment({
        appointmentType: { speciality: { name: 'Dentistry' } },
      } as never);
      expect(
        supportsSpeciality([makeTeam({ speciality: ['dentistry'] })], 'prac-1', appointment)
      ).toBe(true);
      expect(
        supportsSpeciality(
          [makeTeam({ speciality: [{ name: 'Dentistry' }] })],
          'prac-1',
          appointment
        )
      ).toBe(true);
    });

    it('rejects a speciality the target does not hold', () => {
      const appointment = makeAppointment({
        appointmentType: { speciality: { id: 'sp-1', name: 'Dentistry' } },
      } as never);
      const teams = [makeTeam({ speciality: [{ _id: 'sp-2', name: 'Cardiology' }] })];
      expect(supportsSpeciality(teams, 'prac-1', appointment)).toBe(false);
    });
  });

  describe('buildAppointmentStartFromCalendarMinutes', () => {
    it('snaps and clamps the minute before building the date', () => {
      const date = new Date('2026-03-02T00:00:00.000Z');
      expect(buildAppointmentStartFromCalendarMinutes(date, 123).toISOString()).toBe(
        '2026-03-02T02:05:00.000Z'
      );
      expect(buildAppointmentStartFromCalendarMinutes(date, -10).toISOString()).toBe(
        '2026-03-02T00:00:00.000Z'
      );
      expect(buildAppointmentStartFromCalendarMinutes(date, 2000).toISOString()).toBe(
        '2026-03-02T23:55:00.000Z'
      );
    });
  });

  describe('collectValidMinutesForSlot', () => {
    const date = new Date('2026-03-02T00:00:00.000Z');
    const baseParams = () => ({
      date,
      appointment: makeAppointment({ id: 'moved' } as Partial<Appointment>),
      allAppointments: [] as Appointment[],
      normalizedTargetPractitionerId: 'vet-1',
      targetPractitionerId: 'vet-1',
      durationMinutes: 30,
      durationMs: 30 * 60_000,
      nowMs: new Date('2026-03-02T00:00:00.000Z').getTime(),
      minutesSet: new Set<number>(),
    });

    const makeSlot = (overrides: Partial<Slot> = {}): Slot => ({
      startTime: '09:00',
      endTime: '10:00',
      vetIds: ['vet-1'],
      ...overrides,
    });

    it('skips slots the target vet does not staff', () => {
      const params = baseParams();
      collectValidMinutesForSlot(makeSlot({ vetIds: ['vet-2'] }), params);
      expect(params.minutesSet.size).toBe(0);
    });

    it('treats a missing vetIds list as no match', () => {
      const params = baseParams();
      collectValidMinutesForSlot({ startTime: '09:00', endTime: '10:00' } as Slot, params);
      expect(params.minutesSet.size).toBe(0);
    });

    it('collects every 5-minute start that fits the duration', () => {
      const params = baseParams();
      collectValidMinutesForSlot(makeSlot(), params);
      expect([...params.minutesSet]).toEqual([540, 545, 550, 555, 560, 565, 570]);
    });

    it('skips a slot shorter than the appointment duration', () => {
      const params = { ...baseParams(), durationMinutes: 120, durationMs: 120 * 60_000 };
      collectValidMinutesForSlot(makeSlot(), params);
      expect(params.minutesSet.size).toBe(0);
    });

    it('wraps a slot that ends past midnight', () => {
      const params = baseParams();
      collectValidMinutesForSlot(makeSlot({ startTime: '23:00', endTime: '01:00' }), params);
      expect(params.minutesSet.has(1380)).toBe(true);
      expect([...params.minutesSet].every((minute) => minute <= 24 * 60 - 5)).toBe(true);
    });

    it('skips starts already in the past', () => {
      const params = { ...baseParams(), nowMs: new Date('2026-03-02T09:30:00.000Z').getTime() };
      collectValidMinutesForSlot(makeSlot(), params);
      expect([...params.minutesSet]).toEqual([570]);
    });

    it('skips starts that would conflict with an existing appointment', () => {
      const params = {
        ...baseParams(),
        allAppointments: [
          makeAppointment({
            id: 'other',
            startTime: '2026-03-02T09:00:00.000Z',
            endTime: '2026-03-02T09:30:00.000Z',
            lead: { id: 'vet-1' },
          } as never),
        ],
      };
      collectValidMinutesForSlot(makeSlot(), params);
      expect([...params.minutesSet]).toEqual([570]);
    });
  });

  describe('resolveViewAvailabilityIntervals', () => {
    const baseParams = () => ({
      date: new Date('2026-03-02T00:00:00.000Z'),
      targetLeadId: undefined as string | undefined,
      primaryOrgId: 'org-1' as string | null,
      availabilityIdsByOrgId: { 'org-1': ['av-1'] } as Record<string, string[]>,
      availabilitiesById: { 'av-1': { dayOfWeek: 'MONDAY' } } as Record<string, unknown>,
      teams: [] as Team[],
    });

    it('returns nothing without a primary org', () => {
      expect(resolveViewAvailabilityIntervals({ ...baseParams(), primaryOrgId: null })).toEqual([]);
      expect(resolveIntervalsMock).not.toHaveBeenCalled();
    });

    it('returns nothing when the org has no availabilities', () => {
      expect(
        resolveViewAvailabilityIntervals({ ...baseParams(), availabilityIdsByOrgId: {} })
      ).toEqual([]);
    });

    it('drops availability ids with no matching record', () => {
      expect(resolveViewAvailabilityIntervals({ ...baseParams(), availabilitiesById: {} })).toEqual(
        []
      );
    });

    it('resolves org-wide intervals with no target ids', () => {
      const result = resolveViewAvailabilityIntervals(baseParams());
      expect(result).toEqual([{ startMinute: 540, endMinute: 1020 }]);
      expect(resolveIntervalsMock).toHaveBeenCalledWith(
        expect.objectContaining({ dayKey: 'MONDAY', targetIds: undefined })
      );
    });

    it('collects every alias of the matched target member', () => {
      resolveViewAvailabilityIntervals({
        ...baseParams(),
        targetLeadId: 'user-5',
        teams: [
          makeTeam({
            _id: 'team-5',
            practionerId: 'PRAC-5',
            userId: 'user-5',
            id: 'id-5',
            userOrganisation: { userId: 'uo-5' },
          }),
        ],
      });
      const { targetIds } = resolveIntervalsMock.mock.calls.at(-1)[0];
      expect([...targetIds].sort()).toEqual(['id-5', 'prac-5', 'team-5', 'uo-5', 'user-5'].sort());
    });

    it('matches the target member through the id alias', () => {
      resolveViewAvailabilityIntervals({
        ...baseParams(),
        targetLeadId: 'id-6',
        teams: [makeTeam({ _id: 'team-6', practionerId: 'PRAC-6', id: 'id-6' })],
      });
      const { targetIds } = resolveIntervalsMock.mock.calls.at(-1)[0];
      expect([...targetIds].sort()).toEqual(['id-6', 'prac-6', 'team-6'].sort());
    });

    it('matches the target member through the nested organisation user id', () => {
      resolveViewAvailabilityIntervals({
        ...baseParams(),
        targetLeadId: 'uo-7',
        teams: [
          makeTeam({
            _id: 'team-7',
            practionerId: 'PRAC-7',
            userOrganisation: { userId: 'uo-7' },
          }),
        ],
      });
      const { targetIds } = resolveIntervalsMock.mock.calls.at(-1)[0];
      expect([...targetIds].sort()).toEqual(['prac-7', 'team-7', 'uo-7'].sort());
    });

    it('falls back to the raw target id when no team member matches', () => {
      resolveViewAvailabilityIntervals({ ...baseParams(), targetLeadId: 'ghost' });
      const { targetIds } = resolveIntervalsMock.mock.calls.at(-1)[0];
      expect([...targetIds]).toEqual(['ghost']);
    });
  });

  describe('buildDropIntervalsFromStarts', () => {
    it('returns nothing for an empty list', () => {
      expect(buildDropIntervalsFromStarts([])).toEqual([]);
    });

    it('collapses a contiguous run into one interval', () => {
      expect(buildDropIntervalsFromStarts([540, 545, 550])).toEqual([
        { startMinute: 540, endMinute: 550 },
      ]);
    });

    it('splits on gaps larger than one step', () => {
      expect(buildDropIntervalsFromStarts([540, 545, 600, 605])).toEqual([
        { startMinute: 540, endMinute: 545 },
        { startMinute: 600, endMinute: 605 },
      ]);
    });

    it('handles a single start', () => {
      expect(buildDropIntervalsFromStarts([720])).toEqual([{ startMinute: 720, endMinute: 720 }]);
    });
  });
});
