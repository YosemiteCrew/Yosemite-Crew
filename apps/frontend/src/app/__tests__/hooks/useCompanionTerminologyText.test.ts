import { renderHook } from '@testing-library/react';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';
import { useOrgStore } from '@/app/stores/orgStore';

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn(),
}));

describe('useCompanionTerminologyText', () => {
  beforeEach(() => {
    window.localStorage.clear();
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ primaryOrgId: null, orgsById: {} })
    );
  });

  it('returns a function', () => {
    const { result } = renderHook(() => useCompanionTerminologyText());
    expect(typeof result.current).toBe('function');
  });

  it('rewrites companion terminology for HOSPITAL org type', () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        primaryOrgId: 'org1',
        orgsById: { org1: { type: 'HOSPITAL' } },
      })
    );

    const { result } = renderHook(() => useCompanionTerminologyText());
    // HOSPITAL default is PATIENT
    expect(result.current('The companion is sick')).toBe('The patient is sick');
  });

  it('keeps text unchanged for COMPANION terminology (default)', () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        primaryOrgId: 'org1',
        orgsById: { org1: { type: 'BOARDER' } },
      })
    );

    const { result } = renderHook(() => useCompanionTerminologyText());
    // BOARDER default is COMPANION
    expect(result.current('The companion is here')).toBe('The companion is here');
  });

  it('rewrites for GROOMER org (PET terminology)', () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        primaryOrgId: 'org2',
        orgsById: { org2: { type: 'GROOMER' } },
      })
    );

    const { result } = renderHook(() => useCompanionTerminologyText());
    expect(result.current('The companion needs grooming')).toBe('The pet needs grooming');
  });

  it('returns a stable reference when org does not change', () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        primaryOrgId: 'org1',
        orgsById: { org1: { type: 'HOSPITAL' } },
      })
    );

    const { result, rerender } = renderHook(() => useCompanionTerminologyText());
    const fn1 = result.current;
    rerender();
    expect(result.current).toBe(fn1);
  });
});
