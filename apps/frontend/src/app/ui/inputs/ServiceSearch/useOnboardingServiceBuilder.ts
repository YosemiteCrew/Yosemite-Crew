import { Service } from '@yosemite-crew/types';
import { SpecialityWeb } from '@/app/features/organization/types/speciality';
import { useOrgStore } from '@/app/stores/orgStore';
import {
  buildCustomOnboardingServiceTemplate,
  findOnboardingSpecialityTemplate,
  getResolvedBusinessType,
} from '@/app/lib/onboardingSpecialityCatalog';

type BuildServiceOptions = {
  /** Stamp the built service with the speciality's persisted id (edit flow). */
  specialityId?: string;
};

/**
 * Shared between ServiceSearch and ServiceSearchEdit: reads the primary
 * organisation from the org store and returns a builder that resolves
 * `serviceName` against the speciality's onboarding catalog template (falling
 * back to a capitalized custom template) stamped with the organisation id.
 */
export const useOnboardingServiceBuilder = (speciality: SpecialityWeb) => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const primaryOrgType = useOrgStore((state) =>
    state.primaryOrgId ? state.orgsById[state.primaryOrgId]?.type : undefined
  );
  const businessType = getResolvedBusinessType(primaryOrgType);

  return (serviceName: string, buildOptions?: BuildServiceOptions): Service => {
    const matchedTemplate = findOnboardingSpecialityTemplate(
      businessType,
      speciality.name
    )?.services.find((service) => service.name.toLowerCase() === serviceName.toLowerCase());
    const resolvedTemplate =
      matchedTemplate ??
      buildCustomOnboardingServiceTemplate(
        speciality.name,
        serviceName.charAt(0).toUpperCase() + serviceName.slice(1),
        businessType
      );

    const service = {
      ...resolvedTemplate,
      organisationId: primaryOrgId ?? '',
    } as Service;
    return buildOptions ? { ...service, specialityId: buildOptions.specialityId } : service;
  };
};
