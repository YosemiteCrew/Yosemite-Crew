import {
  buildCustomOnboardingServiceTemplate,
  buildStarterServicesForSpeciality,
  findOnboardingSpecialityTemplate,
  getOrgTypeSpecialityContent,
  getRecommendedOnboardingSpecialities,
  getResolvedBusinessType,
} from '@/app/lib/onboardingSpecialityCatalog';

describe('onboardingSpecialityCatalog', () => {
  it('resolves business type safely', () => {
    expect(getResolvedBusinessType('GROOMER')).toBe('GROOMER');
    expect(getResolvedBusinessType('UNKNOWN')).toBe('HOSPITAL');
    expect(getResolvedBusinessType(undefined)).toBe('HOSPITAL');
  });

  it('returns tailored org-type content', () => {
    expect(getOrgTypeSpecialityContent('BREEDER').title).toBe('Recommended for breeders');
    expect(getOrgTypeSpecialityContent('BOARDER').recommended).toContain('Behavior & Training');
  });

  it('returns recommended specialty templates for an org type', () => {
    const breederRecommendations = getRecommendedOnboardingSpecialities('BREEDER');

    expect(
      breederRecommendations.some((item) => item.name === 'Reproduction / Theriogenology')
    ).toBe(true);
    expect(breederRecommendations.some((item) => item.services.length > 0)).toBe(true);
  });

  it('finds a specialty template and exposes starter services', () => {
    const template = findOnboardingSpecialityTemplate('HOSPITAL', 'General Practice');
    const starterServices = buildStarterServicesForSpeciality('General Practice', 'HOSPITAL');

    expect(template?.summary).toContain('Core consultations');
    expect(starterServices[0].name).toBe('General Consult');
  });

  it('builds custom service defaults with production-safe values', () => {
    const customService = buildCustomOnboardingServiceTemplate(
      'General Practice',
      'Custom wellness review',
      'HOSPITAL'
    );

    expect(customService.name).toBe('Custom wellness review');
    expect(customService.durationMinutes).toBe(30);
    expect(customService.cost).toBe(60);
    expect(customService.maxDiscount).toBe(10);
    expect(customService.description).toContain('general practice');
  });
});
