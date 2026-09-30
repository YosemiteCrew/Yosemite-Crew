import { buildWeeklyAppointmentOccurrences } from '@/app/features/appointments/lib/appointmentSeries';
import { setPreferredTimeZone } from '@/app/lib/timezone';

describe('buildWeeklyAppointmentOccurrences', () => {
  beforeEach(() => {
    setPreferredTimeZone('Europe/Berlin');
  });

  it('keeps the clinic wall time and appointment duration across daylight saving time', () => {
    const start = new Date('2026-03-22T09:30:00+01:00');
    const end = new Date('2026-03-22T10:00:00+01:00');

    const occurrences = buildWeeklyAppointmentOccurrences(start, end, 3);

    expect(occurrences).toHaveLength(3);
    expect(occurrences.map(({ startTime }) => startTime.toISOString())).toEqual([
      '2026-03-22T08:30:00.000Z',
      '2026-03-29T07:30:00.000Z',
      '2026-04-05T07:30:00.000Z',
    ]);
    expect(
      occurrences.every(
        ({ endTime, startTime }) => endTime.getTime() - startTime.getTime() === 30 * 60_000
      )
    ).toBe(true);
  });

  it('rejects unbounded occurrence counts and invalid time ranges', () => {
    expect(() => buildWeeklyAppointmentOccurrences(new Date(), new Date(), 1)).toThrow(
      'Choose between 2 and 52 appointments.'
    );
    expect(() =>
      buildWeeklyAppointmentOccurrences(
        new Date('2026-01-02T10:00:00Z'),
        new Date('2026-01-02T10:30:00Z'),
        53
      )
    ).toThrow('Choose between 2 and 52 appointments.');
    expect(() =>
      buildWeeklyAppointmentOccurrences(
        new Date('2026-01-02T10:00:00Z'),
        new Date('2026-01-02T09:00:00Z'),
        2
      )
    ).toThrow('The appointment end must be after its start.');
  });
});
