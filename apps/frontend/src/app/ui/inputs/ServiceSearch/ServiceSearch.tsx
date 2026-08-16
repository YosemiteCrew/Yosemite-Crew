import React from 'react';
import { Service } from '@yosemite-crew/types';
import { SpecialityWeb } from '@/app/features/organization/types/speciality';
import ServiceSearchBase from '@/app/ui/inputs/ServiceSearch/ServiceSearchBase';
import { useOnboardingServiceBuilder } from '@/app/ui/inputs/ServiceSearch/useOnboardingServiceBuilder';

type SpecialityCardProps = {
  speciality: SpecialityWeb;
  setSpecialities: React.Dispatch<React.SetStateAction<SpecialityWeb[]>>;
};

const checkIfAlready = (name: string, services: Service[] = []) =>
  services.some((s) => s.name.toLowerCase() === name.toLowerCase());

const ServiceSearch = ({ speciality, setSpecialities }: SpecialityCardProps) => {
  const buildService = useOnboardingServiceBuilder(speciality);

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
