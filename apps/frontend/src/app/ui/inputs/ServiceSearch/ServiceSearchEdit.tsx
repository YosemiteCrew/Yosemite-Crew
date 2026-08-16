import React from 'react';
import { SpecialityWeb } from '@/app/features/organization/types/speciality';
import { createService } from '@/app/features/organization/services/specialityService';
import ServiceSearchBase from '@/app/ui/inputs/ServiceSearch/ServiceSearchBase';
import { useOnboardingServiceBuilder } from '@/app/ui/inputs/ServiceSearch/useOnboardingServiceBuilder';

type SpecialityCardProps = {
  speciality: SpecialityWeb;
};

const ServiceSearchEdit = ({ speciality }: SpecialityCardProps) => {
  const buildService = useOnboardingServiceBuilder(speciality);

  const handleSelectService = async (serviceName: string) => {
    try {
      await createService(buildService(serviceName, { specialityId: speciality._id }));
    } catch (error) {
      console.log(error);
    }
  };

  const handleAddService = async (name: string) => {
    try {
      await createService(
        buildService(name.charAt(0).toUpperCase() + name.slice(1), {
          specialityId: speciality._id,
        })
      );
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
