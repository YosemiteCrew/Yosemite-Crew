import React from 'react';
import { Service } from '@yosemite-crew/types';
import { SpecialityWeb } from '@/app/features/organization/types/speciality';
import { useOrgStore } from '@/app/stores/orgStore';
import { createService } from '@/app/features/organization/services/specialityService';
import ServiceSearchBase from '@/app/ui/inputs/ServiceSearch/ServiceSearchBase';
import {
  buildCustomOnboardingServiceTemplate,
  findOnboardingSpecialityTemplate,
  getResolvedBusinessType,
} from '@/app/lib/onboardingSpecialityCatalog';

type SpecialityCardProps = {
  speciality: SpecialityWeb;
};

const ServiceSearchEdit = ({ speciality }: SpecialityCardProps) => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const primaryOrgType = useOrgStore((state) =>
    state.primaryOrgId ? state.orgsById[state.primaryOrgId]?.type : undefined
  );
  const businessType = getResolvedBusinessType(primaryOrgType);

  const buildService = (serviceName: string): Service => {
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

    return {
      ...resolvedTemplate,
      organisationId: primaryOrgId ?? '',
      specialityId: speciality._id,
    } as Service;
  };

  const handleSelectService = async (serviceName: string) => {
    try {
      await createService(buildService(serviceName));
    } catch (error) {
      console.log(error);
    }
  };

  const handleAddService = async (name: string) => {
    try {
      await createService(buildService(name.charAt(0).toUpperCase() + name.slice(1)));
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <ServiceSearchBase
      speciality={speciality}
      onSelectService={handleSelectService}
      onAddService={handleAddService}
    />
  );
};

export default ServiceSearchEdit;
