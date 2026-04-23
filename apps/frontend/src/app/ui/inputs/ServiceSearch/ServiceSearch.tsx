import React from 'react';
import { Service } from '@yosemite-crew/types';
import { SpecialityWeb } from '@/app/features/organization/types/speciality';
import { useOrgStore } from '@/app/stores/orgStore';
import ServiceSearchBase from '@/app/ui/inputs/ServiceSearch/ServiceSearchBase';
import {
  buildCustomOnboardingServiceTemplate,
  findOnboardingSpecialityTemplate,
  getResolvedBusinessType,
} from '@/app/lib/onboardingSpecialityCatalog';

type SpecialityCardProps = {
  speciality: SpecialityWeb;
  setSpecialities: React.Dispatch<React.SetStateAction<SpecialityWeb[]>>;
};

const ServiceSearch = ({ speciality, setSpecialities }: SpecialityCardProps) => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const primaryOrgType = useOrgStore((state) =>
    state.primaryOrgId ? state.orgsById[state.primaryOrgId]?.type : undefined
  );
  const businessType = getResolvedBusinessType(primaryOrgType);

  const checkIfAlready = (name: string, services: Service[] = []) =>
    services.some((s) => s.name.toLowerCase() === name.toLowerCase());

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
    } as Service;
  };

  const handleSelectService = (serviceName: string) => {
    setSpecialities((prev: SpecialityWeb[]) =>
      prev.map((sp) => {
        if (sp.name.toLowerCase() !== speciality.name.toLowerCase()) return sp;
        const exists = checkIfAlready(serviceName, sp.services || []);
        if (exists) return sp;
        return {
          ...sp,
          services: [...(sp.services ?? []), buildService(serviceName)],
        };
      })
    );
  };

  const handleAddService = (name: string) => {
    setSpecialities((prev: SpecialityWeb[]) =>
      prev.map((sp) => {
        if (sp.name.toLowerCase() !== speciality.name.toLowerCase()) return sp;
        const exists = checkIfAlready(name, sp.services || []);
        if (exists) return sp;
        return {
          ...sp,
          services: [...(sp.services ?? []), buildService(name)],
        };
      })
    );
  };

  return (
    <ServiceSearchBase
      speciality={speciality}
      onSelectService={handleSelectService}
      onAddService={handleAddService}
    />
  );
};

export default ServiceSearch;
