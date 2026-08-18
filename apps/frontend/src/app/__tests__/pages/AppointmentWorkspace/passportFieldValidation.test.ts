import {
  clinicalDateError,
  hasFieldErrors,
  isoInstantFromLocal,
  localDateTimeError,
  numberError,
  optionalNumber,
  optionalText,
  requiredTextError,
} from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/passportFieldValidation';

describe('hasFieldErrors', () => {
  it('ignores keys whose validation passed', () => {
    expect(hasFieldErrors({ a: undefined, b: undefined })).toBe(false);
    expect(hasFieldErrors({ a: undefined, b: 'Boom.' })).toBe(true);
  });
});

describe('requiredTextError', () => {
  it('rejects blank and whitespace-only values', () => {
    expect(requiredTextError('Vaccine name', '')).toBe('Vaccine name is required.');
    expect(requiredTextError('Vaccine name', '   ')).toBe('Vaccine name is required.');
  });

  it('accepts a real value', () => {
    expect(requiredTextError('Vaccine name', 'Nobivac')).toBeUndefined();
  });
});

describe('clinicalDateError', () => {
  it('accepts an unambiguous ISO calendar date', () => {
    expect(
      clinicalDateError('Date administered', '2026-02-14', { required: true })
    ).toBeUndefined();
  });

  it('rejects calendar overflow rather than letting it roll over', () => {
    // JavaScript would silently read 2026-02-30 as 2 March; the backend 400s it.
    expect(clinicalDateError('Date administered', '2026-02-30', { required: true })).toBe(
      'Date administered must be a real calendar date in YYYY-MM-DD format.'
    );
  });

  it('rejects an ambiguous day/month format', () => {
    expect(clinicalDateError('Sample date', '01/02/2026')).toBe(
      'Sample date must be a real calendar date in YYYY-MM-DD format.'
    );
  });

  it('treats an empty value as required only when the field is required', () => {
    expect(clinicalDateError('Valid until', '')).toBeUndefined();
    expect(clinicalDateError('Sample date', '', { required: true })).toBe(
      'Sample date is required.'
    );
  });
});

describe('isoInstantFromLocal', () => {
  it('converts a datetime-local value into a full ISO instant', () => {
    expect(isoInstantFromLocal('2026-02-14T09:30')).toBe(
      new Date('2026-02-14T09:30').toISOString()
    );
  });

  it('accepts a seconds-precision local value', () => {
    expect(isoInstantFromLocal('2026-02-14T09:30:15')).toBe(
      new Date('2026-02-14T09:30:15').toISOString()
    );
  });

  it('rejects a value that is not a local date and time', () => {
    expect(isoInstantFromLocal('2026-02-14')).toBeUndefined();
    expect(isoInstantFromLocal('')).toBeUndefined();
  });

  it('rejects an impossible calendar day', () => {
    expect(isoInstantFromLocal('2026-02-30T09:30')).toBeUndefined();
  });

  it('rejects an impossible time', () => {
    expect(isoInstantFromLocal('2026-02-14T25:30')).toBeUndefined();
  });
});

describe('localDateTimeError', () => {
  it('requires a value', () => {
    expect(localDateTimeError('Treated at', ' ')).toBe('Treated at is required.');
  });

  it('rejects a value that cannot become an instant', () => {
    expect(localDateTimeError('Treated at', '2026-02-30T09:30')).toBe(
      'Treated at must be a real date and time.'
    );
  });

  it('accepts a real local date and time', () => {
    expect(localDateTimeError('Treated at', '2026-02-14T09:30')).toBeUndefined();
  });
});

describe('numberError', () => {
  it('requires a value only when asked', () => {
    expect(numberError('Weight', '')).toBeUndefined();
    expect(numberError('Result', '', { required: true })).toBe('Result is required.');
  });

  it('rejects a non-numeric value', () => {
    expect(numberError('Result', 'high')).toBe('Result must be a number.');
  });

  it('enforces the minimum the backend enforces', () => {
    expect(numberError('Result', '-0.1', { min: 0 })).toBe('Result must be 0 or more.');
    expect(numberError('Result', '0.5', { min: 0 })).toBeUndefined();
  });
});

describe('optional payload helpers', () => {
  it('omits blank optional text', () => {
    expect(optionalText('  ')).toBeUndefined();
    expect(optionalText(' Merial ')).toBe('Merial');
  });

  it('omits blank optional numbers and parses real ones', () => {
    expect(optionalNumber('')).toBeUndefined();
    expect(optionalNumber('not a number')).toBeUndefined();
    expect(optionalNumber('12.4')).toBe(12.4);
  });
});
