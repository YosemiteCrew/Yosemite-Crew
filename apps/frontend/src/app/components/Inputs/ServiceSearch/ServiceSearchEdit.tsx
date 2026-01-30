import React from "react";
import { Service } from "@yosemite-crew/types";
import { SpecialityWeb } from "@/app/types/speciality";
import { useOrgStore } from "@/app/stores/orgStore";
import { createService } from "@/app/services/specialityService";
import ServiceSearchBase from "./ServiceSearchBase";

type SpecialityCardProps = {
  speciality: SpecialityWeb;
};

const ServiceSearchEdit = ({ speciality }: SpecialityCardProps) => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);

  const buildService = (name: string): Service =>
    ({
      name,
      description: "",
      maxDiscount: 10,
      cost: 10,
      durationMinutes: 15,
      organisationId: primaryOrgId,
      specialityId: speciality._id,
    }) as Service;

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
