import { useEffect, useMemo } from "react";
import { useOrgStore } from "@/app/stores/orgStore";
import { useSpecialityStore } from "@/app/stores/specialityStore";
import { loadSpecialitiesForOrg } from "@/app/services/specialityService";
import { useServiceStore } from "../stores/serviceStore";
import { Service, Speciality } from "@yosemite-crew/types";
import { SpecialityWeb } from "../types/speciality";

export const useLoadSpecialitiesForPrimaryOrg = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const specialityStatus = useSpecialityStore((s) => s.status);

  useEffect(() => {
    if (!primaryOrgId) return;
    if (specialityStatus === "idle") {
      void loadSpecialitiesForOrg();
    }
  }, [primaryOrgId, specialityStatus]);
};

export const useSpecialitiesForPrimaryOrg = (): Speciality[] => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const specialitiesById = useSpecialityStore((s) => s.specialitiesById);

  const specialityIdsByOrgId = useSpecialityStore(
    (s) => s.specialityIdsByOrgId
  );

  return useMemo(() => {
    if (!primaryOrgId) return [];
    const ids = specialityIdsByOrgId[primaryOrgId] ?? [];
    return ids.map((id) => specialitiesById[id]).filter(Boolean);
  }, [primaryOrgId, specialitiesById, specialityIdsByOrgId]);
};

export const useServicesForPrimaryOrgSpecialities = (): Service[] => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const specialityIdsByOrgId = useSpecialityStore(
    (s) => s.specialityIdsByOrgId
  );
  const servicesById = useServiceStore((s) => s.servicesById);

  const serviceIdsBySpecialityId = useServiceStore(
    (s) => s.serviceIdsBySpecialityId
  );

  return useMemo(() => {
    if (!primaryOrgId) return [];
    const specialityIds = specialityIdsByOrgId[primaryOrgId] ?? [];
    const result: Service[] = [];
    for (const specId of specialityIds) {
      const serviceIds = serviceIdsBySpecialityId[specId] ?? [];
      for (const serviceId of serviceIds) {
        const svc = servicesById[serviceId];
        if (svc) result.push(svc);
      }
    }
    return result;
  }, [
    primaryOrgId,
    specialityIdsByOrgId,
    servicesById,
    serviceIdsBySpecialityId,
  ]);
};

export const useSpecialitiesWithServiceNamesForPrimaryOrg = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const specialitiesById = useSpecialityStore((s) => s.specialitiesById);

  const specialityIdsByOrgId = useSpecialityStore(
    (s) => s.specialityIdsByOrgId
  );
  const servicesById = useServiceStore((s) => s.servicesById);

  return useMemo(() => {
    if (!primaryOrgId) return [];

    const specialityIds = specialityIdsByOrgId[primaryOrgId] ?? [];

    return specialityIds.reduce<SpecialityWeb[]>((acc, specId) => {
      const speciality = specialitiesById[specId];
      if (!speciality) return acc;
      const services: Service[] = Object.values<Service>(servicesById).filter(
        (svc) => svc.specialityId === specId
      );
      acc.push({
        ...speciality,
        services,
      });
      return acc;
    }, []);
  }, [primaryOrgId, specialitiesById, specialityIdsByOrgId, servicesById]);
};
