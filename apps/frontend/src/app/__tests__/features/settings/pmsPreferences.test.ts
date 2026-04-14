import {
  DEFAULT_PMS_PREFERENCES,
  getFallbackAnimalTerminology,
  normalizePmsPreferences,
  defaultOpenScreenToRoute,
  routeToDefaultOpenScreen,
  appointmentViewToLocal,
  localToAppointmentView,
  isValidAnimalTerminology,
  serializeTimezoneForProfile,
} from '@/app/features/settings/utils/pmsPreferences';

describe('getFallbackAnimalTerminology', () => {
  it('returns PATIENT for HOSPITAL', () => {
    expect(getFallbackAnimalTerminology('HOSPITAL')).toBe('PATIENT');
  });

  it('returns PATIENT for lowercase hospital', () => {
    expect(getFallbackAnimalTerminology('hospital')).toBe('PATIENT');
  });

  it('returns COMPANION for other org types', () => {
    expect(getFallbackAnimalTerminology('BOARDER')).toBe('COMPANION');
    expect(getFallbackAnimalTerminology('GROOMER')).toBe('COMPANION');
  });

  it('returns COMPANION for null', () => {
    expect(getFallbackAnimalTerminology(null)).toBe('COMPANION');
  });

  it('returns COMPANION for undefined', () => {
    expect(getFallbackAnimalTerminology(undefined)).toBe('COMPANION');
  });
});

describe('normalizePmsPreferences', () => {
  it('returns defaults when value is null', () => {
    const result = normalizePmsPreferences(null);
    expect(result).toEqual(DEFAULT_PMS_PREFERENCES);
  });

  it('returns defaults when value is undefined', () => {
    const result = normalizePmsPreferences(undefined);
    expect(result.defaultOpenScreen).toBe('APPOINTMENTS');
    expect(result.appointmentView).toBe('STATUS_BOARD');
  });

  it('uses provided values when available', () => {
    const result = normalizePmsPreferences({
      defaultOpenScreen: 'DASHBOARD',
      appointmentView: 'CALENDAR',
      animalTerminology: 'PET',
    });
    expect(result.defaultOpenScreen).toBe('DASHBOARD');
    expect(result.appointmentView).toBe('CALENDAR');
    expect(result.animalTerminology).toBe('PET');
  });

  it('falls back to org-type terminology when animalTerminology is not provided', () => {
    const result = normalizePmsPreferences({}, 'HOSPITAL');
    expect(result.animalTerminology).toBe('PATIENT');
  });

  it('uses COMPANION terminology fallback for non-hospital org', () => {
    const result = normalizePmsPreferences({}, 'BOARDER');
    expect(result.animalTerminology).toBe('COMPANION');
  });
});

describe('defaultOpenScreenToRoute', () => {
  it('maps DASHBOARD to /dashboard', () => {
    expect(defaultOpenScreenToRoute('DASHBOARD')).toBe('/dashboard');
  });

  it('maps APPOINTMENTS to /appointments', () => {
    expect(defaultOpenScreenToRoute('APPOINTMENTS')).toBe('/appointments');
  });
});

describe('routeToDefaultOpenScreen', () => {
  it('maps /dashboard to DASHBOARD', () => {
    expect(routeToDefaultOpenScreen('/dashboard')).toBe('DASHBOARD');
  });

  it('maps /appointments to APPOINTMENTS', () => {
    expect(routeToDefaultOpenScreen('/appointments')).toBe('APPOINTMENTS');
  });
});

describe('appointmentViewToLocal', () => {
  it('maps CALENDAR to calendar', () => {
    expect(appointmentViewToLocal('CALENDAR')).toBe('calendar');
  });

  it('maps TABLE to list', () => {
    expect(appointmentViewToLocal('TABLE')).toBe('list');
  });

  it('maps STATUS_BOARD to board', () => {
    expect(appointmentViewToLocal('STATUS_BOARD')).toBe('board');
  });
});

describe('localToAppointmentView', () => {
  it('maps calendar to CALENDAR', () => {
    expect(localToAppointmentView('calendar')).toBe('CALENDAR');
  });

  it('maps list to TABLE', () => {
    expect(localToAppointmentView('list')).toBe('TABLE');
  });

  it('maps board to STATUS_BOARD', () => {
    expect(localToAppointmentView('board')).toBe('STATUS_BOARD');
  });
});

describe('isValidAnimalTerminology', () => {
  it('returns true for valid values', () => {
    expect(isValidAnimalTerminology('ANIMAL')).toBe(true);
    expect(isValidAnimalTerminology('COMPANION')).toBe(true);
    expect(isValidAnimalTerminology('PET')).toBe(true);
    expect(isValidAnimalTerminology('PATIENT')).toBe(true);
  });

  it('returns false for invalid values', () => {
    expect(isValidAnimalTerminology('INVALID')).toBe(false);
    expect(isValidAnimalTerminology(null)).toBe(false);
    expect(isValidAnimalTerminology(undefined)).toBe(false);
    expect(isValidAnimalTerminology('')).toBe(false);
  });
});

describe('serializeTimezoneForProfile', () => {
  it('returns a string containing the timezone name', () => {
    const result = serializeTimezoneForProfile('UTC');
    expect(result).toContain('UTC');
  });

  it('returns a string with UTC offset format', () => {
    const result = serializeTimezoneForProfile('America/New_York');
    expect(result).toContain('America/New_York');
    expect(result).toContain('UTC');
  });
});
