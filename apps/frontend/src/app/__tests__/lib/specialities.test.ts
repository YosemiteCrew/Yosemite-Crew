import { specialties, specialtiesByKey } from '@/app/lib/specialities';

describe('specialties', () => {
  it('returns an array of specialty objects', () => {
    expect(Array.isArray(specialties)).toBe(true);
    expect(specialties.length).toBeGreaterThan(0);
  });

  it('each specialty has a name and services array', () => {
    specialties.forEach((s) => {
      expect(typeof s.name).toBe('string');
      expect(Array.isArray(s.services)).toBe(true);
    });
  });

  it('includes "General Consult" for specialties with includeConsult', () => {
    const generalPractice = specialties.find((s) => s.name === 'General Practice');
    expect(generalPractice).toBeDefined();
    expect(generalPractice?.services[0]).toBe('General Consult');
  });

  it('does not include "General Consult" for Observational tools', () => {
    const observational = specialties.find((s) => s.name === 'Observational tools');
    expect(observational).toBeDefined();
    expect(observational?.services).not.toContain('General Consult');
  });
});

describe('specialtiesByKey', () => {
  it('is an object keyed by specialty name', () => {
    expect(typeof specialtiesByKey).toBe('object');
    expect(specialtiesByKey['General Practice']).toBeDefined();
  });

  it('returns correct specialty for a known key', () => {
    const gp = specialtiesByKey['General Practice'];
    expect(gp.name).toBe('General Practice');
    expect(gp.services).toContain('General Consult');
  });

  it('returns undefined for unknown key', () => {
    expect((specialtiesByKey as any)['Unknown Specialty']).toBeUndefined();
  });
});
