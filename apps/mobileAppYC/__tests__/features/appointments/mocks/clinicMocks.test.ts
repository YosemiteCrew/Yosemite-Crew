import {MOCK_CLINICS} from '@/features/appointments/mocks/clinicMocks';

describe('MOCK_CLINICS', () => {
  it('exports a non-empty array', () => {
    expect(Array.isArray(MOCK_CLINICS)).toBe(true);
    expect(MOCK_CLINICS.length).toBeGreaterThan(0);
  });

  it('has unique ids for every entry', () => {
    const ids = MOCK_CLINICS.map(clinic => clinic.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every entry the required base fields', () => {
    MOCK_CLINICS.forEach(clinic => {
      expect(typeof clinic.id).toBe('string');
      expect(clinic.id.length).toBeGreaterThan(0);
      expect(typeof clinic.name).toBe('string');
      expect(clinic.name.length).toBeGreaterThan(0);
      expect(typeof clinic.category).toBe('string');
      expect(typeof clinic.address).toBe('string');
    });
  });

  it('keeps coordinates within valid latitude/longitude ranges', () => {
    MOCK_CLINICS.forEach(clinic => {
      expect(clinic.lat).toBeGreaterThanOrEqual(-90);
      expect(clinic.lat).toBeLessThanOrEqual(90);
      expect(clinic.lng).toBeGreaterThanOrEqual(-180);
      expect(clinic.lng).toBeLessThanOrEqual(180);
    });
  });

  it('keeps ratings within the 0-5 scale', () => {
    MOCK_CLINICS.forEach(clinic => {
      expect(clinic.rating).toBeGreaterThanOrEqual(0);
      expect(clinic.rating).toBeLessThanOrEqual(5);
    });
  });

  it('provides a positive distance for every entry', () => {
    MOCK_CLINICS.forEach(clinic => {
      expect(clinic.distanceMi).toBeGreaterThan(0);
    });
  });

  it('only uses known business categories', () => {
    const allowedCategories = new Set([
      'hospital',
      'groomer',
      'pet_center',
      'breeder',
      'boarder',
    ]);
    MOCK_CLINICS.forEach(clinic => {
      expect(allowedCategories.has(clinic.category)).toBe(true);
    });
  });

  it('includes at least one clinic with check-in buffer/radius configured', () => {
    const withCheckIn = MOCK_CLINICS.filter(
      clinic =>
        clinic.appointmentCheckInBufferMinutes !== undefined &&
        clinic.appointmentCheckInRadiusMeters !== undefined,
    );
    expect(withCheckIn.length).toBeGreaterThan(0);
  });

  it('includes at least one clinic without check-in buffer/radius configured', () => {
    const withoutCheckIn = MOCK_CLINICS.filter(
      clinic =>
        clinic.appointmentCheckInBufferMinutes === undefined &&
        clinic.appointmentCheckInRadiusMeters === undefined,
    );
    expect(withoutCheckIn.length).toBeGreaterThan(0);
  });

  it('gives every entry at least one specialty', () => {
    MOCK_CLINICS.forEach(clinic => {
      expect(Array.isArray(clinic.specialties)).toBe(true);
      expect(clinic.specialties!.length).toBeGreaterThan(0);
    });
  });

  it('contains valid email and phone formats', () => {
    MOCK_CLINICS.forEach(clinic => {
      expect(clinic.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(clinic.phone).toMatch(/^\+1 \(\d{3}\) \d{3}-\d{4}$/);
    });
  });
});
