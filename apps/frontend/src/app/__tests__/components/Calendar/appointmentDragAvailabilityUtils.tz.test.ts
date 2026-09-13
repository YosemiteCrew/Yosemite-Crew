import { getSlotCacheKey } from '@/app/features/appointments/components/Calendar/appointmentDragAvailabilityUtils';
import { buildPreferredTimeZoneDayInstant, setPreferredTimeZone } from '@/app/lib/timezone';

afterEach(() => {
  window.localStorage.clear();
});

describe('getSlotCacheKey', () => {
  it('keys by the clinic calendar day, not a UTC slice of the instant', () => {
    // Pacific/Kiritimati is UTC+14: local noon on 7 July is still 6 July in UTC,
    // so a naive date.toISOString().slice(0, 10) would key this under the wrong day.
    setPreferredTimeZone('Pacific/Kiritimati');
    const noon = buildPreferredTimeZoneDayInstant(2026, 7, 7);

    expect(getSlotCacheKey('service-1', noon)).toBe('service-1:2026-07-07');
  });

  it('gives two different clinic days two different cache keys', () => {
    setPreferredTimeZone('Pacific/Auckland');
    const monday = buildPreferredTimeZoneDayInstant(2026, 7, 6);
    const tuesday = buildPreferredTimeZoneDayInstant(2026, 7, 7);

    expect(getSlotCacheKey('service-1', monday)).not.toBe(getSlotCacheKey('service-1', tuesday));
  });
});
