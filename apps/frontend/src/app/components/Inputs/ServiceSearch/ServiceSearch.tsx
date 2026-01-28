import React from "react";
import { Service } from "@yosemite-crew/types";
import { SpecialityWeb } from "@/app/types/speciality";
import { useOrgStore } from "@/app/stores/orgStore";
import ServiceSearchBase from "./ServiceSearchBase";

type SpecialityCardProps = {
  speciality: SpecialityWeb;
  setSpecialities: React.Dispatch<React.SetStateAction<SpecialityWeb[]>>;
};

const ServiceSearch = ({ speciality, setSpecialities }: SpecialityCardProps) => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);

  const checkIfAlready = (name: string, services: Service[] = []) =>
    services.some((s) => s.name.toLowerCase() === name.toLowerCase());

  const handleSelectService = (serviceName: string) => {
    setSpecialities((prev: SpecialityWeb[]) =>
      prev.map((sp) => {
        if (sp.name.toLowerCase() !== speciality.name.toLowerCase()) return sp;
        const exists = checkIfAlready(serviceName, sp.services || []);
        if (exists) return sp;
        return {
          ...sp,
          services: [
            ...(sp.services ?? []),
            {
              name: serviceName,
              description: "",
              maxDiscount: 10,
              cost: 10,
              durationMinutes: 15,
              organisationId: primaryOrgId,
            } as Service,
          ],
        };
      }),
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
          services: [
            ...(sp.services ?? []),
            {
              name: name.charAt(0).toUpperCase() + name.slice(1),
              description: "",
              maxDiscount: 10,
              cost: 15,
              durationMinutes: 15,
              organisationId: primaryOrgId,
            } as Service,
          ],
        };
      }),
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
