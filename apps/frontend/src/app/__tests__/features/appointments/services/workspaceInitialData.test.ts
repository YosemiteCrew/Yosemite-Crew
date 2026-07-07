import {
  OBSERVATION_TOOLS,
  buildEmptyEncounter,
} from '@/app/features/appointments/services/workspaceInitialData';

describe('OBSERVATION_TOOLS', () => {
  it('includes the feline and canine pain scale definitions', () => {
    expect(OBSERVATION_TOOLS).toHaveLength(2);
    expect(OBSERVATION_TOOLS.map((tool) => tool.key)).toEqual(['FGS', 'CSU_CAP']);
    expect(OBSERVATION_TOOLS.every((tool) => tool.name && tool.intro)).toBe(true);
  });
});

describe('buildEmptyEncounter', () => {
  it('builds an outpatient encounter shell', () => {
    const encounter = buildEmptyEncounter('appt-1', 'OUTPATIENT');

    expect(encounter.appointmentId).toBe('appt-1');
    expect(encounter.mode).toBe('OUTPATIENT');
    expect(encounter.consultationType).toBe('Outpatient');
    expect(encounter.currency).toBe('USD');
    expect(encounter.depositCents).toBe(0);
    expect(encounter.taxPercent).toBe(0);
    expect(encounter.overallDiscountPercent).toBe(0);
    expect(encounter.withdrawDeposit).toBe(false);
    expect(encounter.viewOnly).toBe(false);
    expect(encounter.readyForBilling).toEqual({ value: false });
    expect(encounter.readyForDischarge).toEqual({ value: false });
    expect(encounter.stepStatus).toEqual({
      SOAP: 'EMPTY',
      DIAGNOSTICS: 'EMPTY',
      TREATMENT: 'EMPTY',
      INVOICE: 'EMPTY',
      SUMMARY: 'EMPTY',
    });
    expect(encounter.soap).toEqual([]);
    expect(encounter.vitals).toEqual([]);
    expect(encounter.observations).toEqual([]);
    expect(encounter.documents).toEqual([]);
    expect(encounter.leadId).toBeUndefined();
    expect(encounter.roomId).toBeUndefined();
  });

  it('builds an inpatient encounter shell', () => {
    const encounter = buildEmptyEncounter('appt-2', 'INPATIENT');

    expect(encounter.mode).toBe('INPATIENT');
    expect(encounter.consultationType).toBe('Inpatient');
  });

  it('returns a fresh stepStatus object per call so callers cannot mutate a shared instance', () => {
    const first = buildEmptyEncounter('appt-1', 'OUTPATIENT');
    const second = buildEmptyEncounter('appt-2', 'OUTPATIENT');

    expect(first.stepStatus).not.toBe(second.stepStatus);
  });
});
