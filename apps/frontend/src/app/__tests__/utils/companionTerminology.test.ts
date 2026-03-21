import {
  getCompanionTerminologyForOrg,
  getDefaultCompanionTerminologyForOrgType,
} from '@/app/lib/companionTerminology';

describe('companionTerminology defaults', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns org-type defaults', () => {
    expect(getDefaultCompanionTerminologyForOrgType('HOSPITAL')).toBe('PATIENT');
    expect(getDefaultCompanionTerminologyForOrgType('BOARDER')).toBe('COMPANION');
    expect(getDefaultCompanionTerminologyForOrgType('BREEDER')).toBe('ANIMAL');
    expect(getDefaultCompanionTerminologyForOrgType('GROOMER')).toBe('PET');
  });

  it('falls back to org-type default when no saved terminology exists', () => {
    expect(getCompanionTerminologyForOrg('org-hospital', 'HOSPITAL')).toBe('PATIENT');
    expect(getCompanionTerminologyForOrg('org-boarder', 'BOARDER')).toBe('COMPANION');
    expect(getCompanionTerminologyForOrg('org-breeder', 'BREEDER')).toBe('ANIMAL');
    expect(getCompanionTerminologyForOrg('org-groomer', 'GROOMER')).toBe('PET');
  });

  it('uses saved terminology over org-type defaults', () => {
    window.localStorage.setItem(
      'yc_companion_terminology_by_org',
      JSON.stringify({ 'org-hospital': 'PET' })
    );

    expect(getCompanionTerminologyForOrg('org-hospital', 'HOSPITAL')).toBe('PET');
  });
});
