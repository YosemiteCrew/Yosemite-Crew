import {
  getDefaultCompanionTerminologyForOrgType,
  getCompanionTerminologyOptions,
  getCompanionTerminologyForOrg,
  setPendingCompanionTerminology,
  bindPendingCompanionTerminologyToOrg,
  setCompanionTerminologyForOrg,
  rewriteCompanionTerminologyText,
} from '@/app/lib/companionTerminology';

beforeEach(() => {
  window.localStorage.clear();
});

describe('getDefaultCompanionTerminologyForOrgType', () => {
  it('returns PATIENT for HOSPITAL', () => {
    expect(getDefaultCompanionTerminologyForOrgType('HOSPITAL')).toBe('PATIENT');
  });

  it('returns COMPANION for BOARDER', () => {
    expect(getDefaultCompanionTerminologyForOrgType('BOARDER')).toBe('COMPANION');
  });

  it('returns ANIMAL for BREEDER', () => {
    expect(getDefaultCompanionTerminologyForOrgType('BREEDER')).toBe('ANIMAL');
  });

  it('returns PET for GROOMER', () => {
    expect(getDefaultCompanionTerminologyForOrgType('GROOMER')).toBe('PET');
  });

  it('returns COMPANION for unknown org type', () => {
    expect(getDefaultCompanionTerminologyForOrgType('UNKNOWN')).toBe('COMPANION');
  });

  it('returns COMPANION for null', () => {
    expect(getDefaultCompanionTerminologyForOrgType(null)).toBe('COMPANION');
  });

  it('is case-insensitive', () => {
    expect(getDefaultCompanionTerminologyForOrgType('hospital')).toBe('PATIENT');
  });
});

describe('getCompanionTerminologyOptions', () => {
  it('returns 4 options', () => {
    expect(getCompanionTerminologyOptions()).toHaveLength(4);
  });

  it('includes COMPANION, PET, ANIMAL, PATIENT', () => {
    const values = getCompanionTerminologyOptions().map((o) => o.value);
    expect(values).toContain('COMPANION');
    expect(values).toContain('PET');
    expect(values).toContain('ANIMAL');
    expect(values).toContain('PATIENT');
  });
});

describe('getCompanionTerminologyForOrg', () => {
  it('returns org-type default when no stored override', () => {
    expect(getCompanionTerminologyForOrg('org1', 'HOSPITAL')).toBe('PATIENT');
  });

  it('returns stored override for a specific org', () => {
    setCompanionTerminologyForOrg('org1', 'PET');
    expect(getCompanionTerminologyForOrg('org1', 'HOSPITAL')).toBe('PET');
  });

  it('returns org-type default for a different org with no override', () => {
    setCompanionTerminologyForOrg('org1', 'PET');
    expect(getCompanionTerminologyForOrg('org2', 'HOSPITAL')).toBe('PATIENT');
  });

  it('returns pending value when orgId is empty', () => {
    setPendingCompanionTerminology('ANIMAL');
    expect(getCompanionTerminologyForOrg(null, 'HOSPITAL')).toBe('ANIMAL');
  });

  it('uses orgType default when no pending and no orgId', () => {
    expect(getCompanionTerminologyForOrg(null, 'BOARDER')).toBe('COMPANION');
  });
});

describe('setPendingCompanionTerminology', () => {
  it('stores pending value and returns true', () => {
    expect(setPendingCompanionTerminology('PET')).toBe(true);
    expect(window.localStorage.getItem('yc_companion_terminology_pending')).toBe('PET');
  });
});

describe('bindPendingCompanionTerminologyToOrg', () => {
  it('binds pending value to org and clears pending', () => {
    setPendingCompanionTerminology('ANIMAL');
    const result = bindPendingCompanionTerminologyToOrg('org-abc');
    expect(result).toBe(true);
    expect(window.localStorage.getItem('yc_companion_terminology_pending')).toBeNull();
    expect(getCompanionTerminologyForOrg('org-abc')).toBe('ANIMAL');
  });

  it('returns false when no pending value exists', () => {
    expect(bindPendingCompanionTerminologyToOrg('org-xyz')).toBe(false);
  });

  it('returns false for empty orgId', () => {
    setPendingCompanionTerminology('PET');
    expect(bindPendingCompanionTerminologyToOrg(null)).toBe(false);
  });
});

describe('setCompanionTerminologyForOrg', () => {
  it('stores the terminology for an org', () => {
    expect(setCompanionTerminologyForOrg('org1', 'PATIENT')).toBe(true);
    expect(getCompanionTerminologyForOrg('org1')).toBe('PATIENT');
  });

  it('returns false for empty orgId', () => {
    expect(setCompanionTerminologyForOrg('', 'PET')).toBe(false);
  });

  it('returns false for undefined orgId', () => {
    expect(setCompanionTerminologyForOrg(undefined, 'PET')).toBe(false);
  });
});

describe('rewriteCompanionTerminologyText', () => {
  it('replaces "companion" with "pet" (singular)', () => {
    expect(rewriteCompanionTerminologyText('The companion is here', 'PET')).toBe('The pet is here');
  });

  it('replaces "companions" with "pets" (plural)', () => {
    expect(rewriteCompanionTerminologyText('All companions need care', 'PET')).toBe(
      'All pets need care'
    );
  });

  it('preserves case — all caps', () => {
    expect(rewriteCompanionTerminologyText('COMPANION is ready', 'PET')).toBe('PET is ready');
  });

  it('preserves case — title case', () => {
    expect(rewriteCompanionTerminologyText('Companion is ready', 'PET')).toBe('Pet is ready');
  });

  it('replaces "patient" with "animal"', () => {
    expect(rewriteCompanionTerminologyText('The patient is ill', 'ANIMAL')).toBe(
      'The animal is ill'
    );
  });

  it('replaces "patients" with "animals"', () => {
    expect(rewriteCompanionTerminologyText('All patients recovered', 'ANIMAL')).toBe(
      'All animals recovered'
    );
  });

  it('returns original string when empty', () => {
    expect(rewriteCompanionTerminologyText('', 'PET')).toBe('');
  });

  it('handles COMPANION option (no-op replacement)', () => {
    expect(rewriteCompanionTerminologyText('The companion is here', 'COMPANION')).toBe(
      'The companion is here'
    );
  });
});
