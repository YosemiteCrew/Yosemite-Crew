import { renderHook } from '@testing-library/react';
import { useOnboardingServiceBuilder } from '@/app/ui/inputs/ServiceSearch/useOnboardingServiceBuilder';
import { useOrgStore } from '@/app/stores/orgStore';
import {
  buildCustomOnboardingServiceTemplate,
  findOnboardingSpecialityTemplate,
  getResolvedBusinessType,
} from '@/app/lib/onboardingSpecialityCatalog';
import { SpecialityWeb } from '@/app/features/organization/types/speciality';

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn(),
}));

jest.mock('@/app/lib/onboardingSpecialityCatalog', () => ({
  buildCustomOnboardingServiceTemplate: jest.fn(),
  findOnboardingSpecialityTemplate: jest.fn(),
  getResolvedBusinessType: jest.fn(),
}));

const speciality = { _id: 'spec-1', name: 'General Practice' } as SpecialityWeb;

const mockState = (state: {
  primaryOrgId?: string;
  orgsById?: Record<string, { type?: string }>;
}) => {
  (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
    selector({ primaryOrgId: undefined, orgsById: {}, ...state })
  );
};

describe('useOnboardingServiceBuilder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getResolvedBusinessType as jest.Mock).mockReturnValue('HOSPITAL');
    (findOnboardingSpecialityTemplate as jest.Mock).mockReturnValue(undefined);
    (buildCustomOnboardingServiceTemplate as jest.Mock).mockImplementation(
      (specialityName: string, serviceName: string) => ({
        name: serviceName,
        cost: 60,
        durationMinutes: 30,
      })
    );
    mockState({ primaryOrgId: 'org-1', orgsById: { 'org-1': { type: 'GROOMER' } } });
  });

  it('resolves a case-insensitive catalog template match and stamps the organisation id', () => {
    (findOnboardingSpecialityTemplate as jest.Mock).mockReturnValue({
      services: [{ name: 'Checkup', cost: 45, durationMinutes: 20 }],
    });

    const { result } = renderHook(() => useOnboardingServiceBuilder(speciality));
    const service = result.current('checkup');

    expect(getResolvedBusinessType).toHaveBeenCalledWith('GROOMER');
    expect(findOnboardingSpecialityTemplate).toHaveBeenCalledWith('HOSPITAL', 'General Practice');
    expect(buildCustomOnboardingServiceTemplate).not.toHaveBeenCalled();
    expect(service).toEqual({
      name: 'Checkup',
      cost: 45,
      durationMinutes: 20,
      organisationId: 'org-1',
    });
    expect('specialityId' in service).toBe(false);
  });

  it('falls back to a capitalized custom template when no catalog service matches', () => {
    (findOnboardingSpecialityTemplate as jest.Mock).mockReturnValue({
      services: [{ name: 'Checkup', cost: 45, durationMinutes: 20 }],
    });

    const { result } = renderHook(() => useOnboardingServiceBuilder(speciality));
    const service = result.current('grooming');

    expect(buildCustomOnboardingServiceTemplate).toHaveBeenCalledWith(
      'General Practice',
      'Grooming',
      'HOSPITAL'
    );
    expect(service).toEqual({
      name: 'Grooming',
      cost: 60,
      durationMinutes: 30,
      organisationId: 'org-1',
    });
  });

  it('builds a custom template when the speciality has no catalog entry at all', () => {
    const { result } = renderHook(() => useOnboardingServiceBuilder(speciality));
    const service = result.current('Dental');

    expect(buildCustomOnboardingServiceTemplate).toHaveBeenCalledWith(
      'General Practice',
      'Dental',
      'HOSPITAL'
    );
    expect(service.organisationId).toBe('org-1');
  });

  it('stamps the speciality id when the edit flow passes one', () => {
    const { result } = renderHook(() => useOnboardingServiceBuilder(speciality));
    const service = result.current('Dental', { specialityId: 'spec-1' });

    expect(service.specialityId).toBe('spec-1');
  });

  it('falls back to an empty organisation id and undefined org type without a primary org', () => {
    mockState({ primaryOrgId: undefined });

    const { result } = renderHook(() => useOnboardingServiceBuilder(speciality));
    const service = result.current('Dental');

    expect(getResolvedBusinessType).toHaveBeenCalledWith(undefined);
    expect(service.organisationId).toBe('');
  });

  it('resolves an undefined org type when the primary org is not in the store map', () => {
    mockState({ primaryOrgId: 'org-2', orgsById: {} });

    const { result } = renderHook(() => useOnboardingServiceBuilder(speciality));
    result.current('Dental');

    expect(getResolvedBusinessType).toHaveBeenCalledWith(undefined);
  });
});
