import {
  companionAlertsToStoredAlerts,
  isAlertSeverity,
  storedAlertsToCompanionAlerts,
} from '@/app/features/appointments/lib/alertMapping';

describe('alertMapping', () => {
  it('maps stored backend alerts to workspace alerts', () => {
    expect(
      storedAlertsToCompanionAlerts(
        [
          { title: 'Needs muzzle', severity: 'high' },
          { title: 'Call before visit', severity: 'low' },
        ],
        'patient-alert'
      )
    ).toEqual([
      { id: 'patient-alert-0', label: 'Needs muzzle', severity: 'high' },
      { id: 'patient-alert-1', label: 'Call before visit', severity: 'low' },
    ]);
  });

  it('drops incomplete or unsupported stored alerts', () => {
    expect(
      storedAlertsToCompanionAlerts(
        [
          { title: '', severity: 'high' },
          { title: 'Unsupported', severity: 'admin' },
          { title: 'Valid', severity: 'critical' },
        ],
        'client-alert'
      )
    ).toEqual([{ id: 'client-alert-2', label: 'Valid', severity: 'critical' }]);
  });

  it('maps workspace alerts back to the backend payload shape', () => {
    expect(
      companionAlertsToStoredAlerts([
        { label: 'Diabetic', severity: 'medium' },
        { label: 'Do not feed', severity: 'critical' },
      ])
    ).toEqual([
      { title: 'Diabetic', severity: 'medium' },
      { title: 'Do not feed', severity: 'critical' },
    ]);
  });

  it('validates supported severities', () => {
    expect(isAlertSeverity('low')).toBe(true);
    expect(isAlertSeverity('admin')).toBe(false);
    expect(isAlertSeverity(undefined)).toBe(false);
  });

  it('treats a missing alerts array as empty', () => {
    expect(storedAlertsToCompanionAlerts(undefined, 'prefix')).toEqual([]);
  });

  it('drops alerts with a valid title but an undefined severity', () => {
    expect(storedAlertsToCompanionAlerts([{ title: 'No severity' }], 'prefix')).toEqual([]);
  });

  it('drops alerts whose title is only whitespace', () => {
    expect(storedAlertsToCompanionAlerts([{ title: '   ', severity: 'high' }], 'prefix')).toEqual(
      []
    );
  });
});
