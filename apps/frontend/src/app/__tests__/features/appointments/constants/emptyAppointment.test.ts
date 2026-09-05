import { EMPTY_APPOINTMENT } from '@/app/features/appointments/constants/emptyAppointment';

// The three timestamps are accessors precisely so that importing this module
// under SSR does not bake the server's start-up instant into every blank form
// for the life of the process. These two tests are what stops someone turning
// them back into `new Date()` literals.
describe('EMPTY_APPOINTMENT', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reads the current time on every access rather than one frozen at import', () => {
    jest.setSystemTime(new Date('2026-03-01T09:00:00.000Z'));
    const first = EMPTY_APPOINTMENT.appointmentDate.getTime();
    const firstStart = EMPTY_APPOINTMENT.startTime.getTime();
    const firstEnd = EMPTY_APPOINTMENT.endTime.getTime();

    jest.setSystemTime(new Date('2026-03-02T09:00:00.000Z'));

    expect(EMPTY_APPOINTMENT.appointmentDate.getTime()).toBe(first + 86_400_000);
    expect(EMPTY_APPOINTMENT.startTime.getTime()).toBe(firstStart + 86_400_000);
    expect(EMPTY_APPOINTMENT.endTime.getTime()).toBe(firstEnd + 86_400_000);
  });

  it('snapshots plain dates when spread, so a copy does not keep moving', () => {
    jest.setSystemTime(new Date('2026-03-01T09:00:00.000Z'));
    const draft = { ...EMPTY_APPOINTMENT };

    jest.setSystemTime(new Date('2026-03-02T09:00:00.000Z'));

    expect(draft.appointmentDate).toEqual(new Date('2026-03-01T09:00:00.000Z'));
    expect(draft.startTime).toEqual(new Date('2026-03-01T09:00:00.000Z'));
    expect(draft.endTime).toEqual(new Date('2026-03-01T09:00:00.000Z'));
  });

  it('still ships the blank-form defaults the callers rely on', () => {
    expect(EMPTY_APPOINTMENT.status).toBe('REQUESTED');
    expect(EMPTY_APPOINTMENT.isEmergency).toBe(false);
    expect(EMPTY_APPOINTMENT.supportStaff).toEqual([]);
  });
});
