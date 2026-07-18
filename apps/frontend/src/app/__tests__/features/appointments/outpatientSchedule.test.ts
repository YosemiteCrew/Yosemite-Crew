import { buildOutpatientSchedule } from '@/app/features/appointments/lib/outpatientSchedule';
import type { Appointment } from '@yosemite-crew/types';

const NOW = new Date('2026-07-13T09:00:00.000Z').getTime(); // a Monday

const appt = (
  id: string,
  overrides: Partial<Appointment> & { startOffsetMs?: number; status?: string } = {}
): Appointment => {
  const { startOffsetMs = 0, status = 'UPCOMING', ...rest } = overrides;
  return {
    id,
    patient: { id: 'poppy', name: 'Poppy', species: 'dog', parent: { id: 'lena', name: 'Lena' } },
    lead: { id: 'sw', name: 'Dr. Sarah Weber' },
    room: { id: 'r1', name: 'Room 1' },
    appointmentType: { id: 'svc', name: 'Recheck', speciality: { id: 's', name: 'General' } },
    organisationId: 'org-1',
    startTime: new Date(NOW + startOffsetMs),
    endTime: new Date(NOW + startOffsetMs + 20 * 60 * 1000),
    durationMinutes: 20,
    status,
    ...rest,
  } as unknown as Appointment;
};

const DAY = 24 * 60 * 60 * 1000;

describe('buildOutpatientSchedule', () => {
  it('buckets future companion visits into this week and next week', () => {
    const schedule = buildOutpatientSchedule(
      [
        appt('current'),
        appt('a', { startOffsetMs: 2 * DAY }), // this week
        appt('b', { startOffsetMs: 9 * DAY }), // next week
      ],
      { companionId: 'poppy', excludeAppointmentId: 'current', nowMs: NOW }
    );
    expect(schedule.thisWeek.map((v) => v.id)).toEqual(['a']);
    expect(schedule.nextWeek.map((v) => v.id)).toEqual(['b']);
    expect(schedule.total).toBe(2);
  });

  it('excludes the current appointment, past visits and cancelled/completed/no-show', () => {
    const schedule = buildOutpatientSchedule(
      [
        appt('current'),
        appt('past', { startOffsetMs: -DAY }),
        appt('cancelled', { startOffsetMs: DAY, status: 'CANCELLED' }),
        appt('completed', { startOffsetMs: DAY, status: 'COMPLETED' }),
        appt('noshow', { startOffsetMs: DAY, status: 'NO_SHOW' }),
        appt('keep', { startOffsetMs: DAY }),
      ],
      { companionId: 'poppy', excludeAppointmentId: 'current', nowMs: NOW }
    );
    expect(schedule.total).toBe(1);
    expect(schedule.thisWeek[0].id).toBe('keep');
  });

  it('filters to the given companion', () => {
    const other = appt('other', { startOffsetMs: DAY });
    (other as unknown as { patient: { id: string } }).patient.id = 'buddy';
    const schedule = buildOutpatientSchedule([appt('mine', { startOffsetMs: DAY }), other], {
      companionId: 'poppy',
      nowMs: NOW,
    });
    expect(schedule.total).toBe(1);
    expect(schedule.thisWeek[0].id).toBe('mine');
  });

  it('marks requested visits as proposed and counts them', () => {
    const schedule = buildOutpatientSchedule(
      [
        appt('sched', { startOffsetMs: DAY }),
        appt('prop', { startOffsetMs: 8 * DAY, status: 'REQUESTED' }),
      ],
      { companionId: 'poppy', nowMs: NOW }
    );
    expect(schedule.thisWeek[0].status).toBe('SCHEDULED');
    expect(schedule.nextWeek[0].status).toBe('PROPOSED');
    expect(schedule.proposedCount).toBe(1);
  });

  it('sorts each bucket by start time and derives row detail', () => {
    const schedule = buildOutpatientSchedule(
      [appt('later', { startOffsetMs: 3 * DAY }), appt('sooner', { startOffsetMs: DAY })],
      { companionId: 'poppy', nowMs: NOW }
    );
    expect(schedule.thisWeek.map((v) => v.id)).toEqual(['sooner', 'later']);
    expect(schedule.thisWeek[0]).toMatchObject({
      title: 'Recheck',
      leadName: 'Dr. Sarah Weber',
      roomName: 'Room 1',
      durationMinutes: 20,
    });
  });

  it('skips appointments without an id or an unparseable start', () => {
    const noId = appt('x', { startOffsetMs: DAY });
    (noId as unknown as { id?: string }).id = undefined;
    const badStart = appt('bad', { startOffsetMs: DAY });
    (badStart as unknown as { startTime: unknown }).startTime = 'not-a-date';
    const schedule = buildOutpatientSchedule([noId, badStart], { nowMs: NOW });
    expect(schedule.total).toBe(0);
  });

  it('keeps a stable order when two visits share a start time', () => {
    const schedule = buildOutpatientSchedule(
      [
        appt('same-a', { startOffsetMs: DAY }),
        appt('same-b', { startOffsetMs: DAY }),
        appt('later', { startOffsetMs: 2 * DAY }),
      ],
      { companionId: 'poppy', nowMs: NOW }
    );
    expect(schedule.thisWeek.map((v) => v.id)).toEqual(['same-a', 'same-b', 'later']);
  });

  it('falls back to a generic title when no service name is present', () => {
    const untyped = appt('u', { startOffsetMs: DAY });
    (untyped as unknown as { appointmentType?: unknown }).appointmentType = undefined;
    const schedule = buildOutpatientSchedule([untyped], { companionId: 'poppy', nowMs: NOW });
    expect(schedule.thisWeek[0].title).toBe('Scheduled visit');
  });

  it('skips a visit with no start and leaves lead/room undefined when absent', () => {
    const noStart = appt('nostart', { startOffsetMs: DAY });
    (noStart as unknown as { startTime?: unknown }).startTime = undefined;
    const bare = appt('bare', { startOffsetMs: DAY });
    (bare as unknown as { lead?: unknown; room?: unknown }).lead = undefined;
    (bare as unknown as { room?: unknown }).room = undefined;
    const schedule = buildOutpatientSchedule([noStart, bare], { companionId: 'poppy', nowMs: NOW });
    expect(schedule.total).toBe(1);
    expect(schedule.thisWeek[0].id).toBe('bare');
    expect(schedule.thisWeek[0].leadName).toBeUndefined();
    expect(schedule.thisWeek[0].roomName).toBeUndefined();
  });
});
