import { Service } from "@yosemite-crew/types";
import { create } from "zustand";

type ServiceState = {
  servicesById: Record<string, Service>;
  serviceIdsByOrgId: Record<string, string[]>;
  serviceIdsBySpecialityId: Record<string, string[]>;

  setServices: (services: Service[]) => void;
  addService: (service: Service) => void;
  updateService: (updated: Service) => void;
  getServicesByOrgId: (orgId: string) => Service[];
  getServicesBySpecialityId: (specialityId: string) => Service[];
  clearServices: () => void;
};

export const useServiceStore = create<ServiceState>()((set, get) => ({
  servicesById: {},
  serviceIdsByOrgId: {},
  serviceIdsBySpecialityId: {},

  setServices: (services) =>
    set(() => {
      const servicesById: Record<string, Service> = {};
      const serviceIdsByOrgId: Record<string, string[]> = {};
      const serviceIdsBySpecialityId: Record<string, string[]> = {};
      for (const service of services) {
        const id = service.id ?? service.name;
        const orgId = service.organisationId;
        const specialityId = service.specialityId ?? undefined;
        servicesById[id] = { ...service, id };
        if (!serviceIdsByOrgId[orgId]) {
          serviceIdsByOrgId[orgId] = [];
        }
        serviceIdsByOrgId[orgId].push(id);
        if (specialityId) {
          if (!serviceIdsBySpecialityId[specialityId]) {
            serviceIdsBySpecialityId[specialityId] = [];
          }
          serviceIdsBySpecialityId[specialityId].push(id);
        }
      }
      return {
        servicesById,
        serviceIdsByOrgId,
        serviceIdsBySpecialityId,
      };
    }),

  addService: (service) =>
    set((state) => {
      const id = service.id ?? service.name;
      const orgId = service.organisationId;
      const specialityId = service.specialityId ?? undefined;
      const servicesById: Record<string, Service> = {
        ...state.servicesById,
        [id]: { ...service, id },
      };
      // Org mapping
      const existingIdsForOrg = state.serviceIdsByOrgId[orgId] ?? [];
      const alreadyListedForOrg = existingIdsForOrg.includes(id);
      const serviceIdsByOrgId: Record<string, string[]> = {
        ...state.serviceIdsByOrgId,
        [orgId]: alreadyListedForOrg
          ? existingIdsForOrg
          : [...existingIdsForOrg, id],
      };
      // Speciality mapping
      let serviceIdsBySpecialityId = state.serviceIdsBySpecialityId;
      if (specialityId) {
        const existingIdsForSpec =
          state.serviceIdsBySpecialityId[specialityId] ?? [];
        const alreadyListedForSpec = existingIdsForSpec.includes(id);
        serviceIdsBySpecialityId = {
          ...state.serviceIdsBySpecialityId,
          [specialityId]: alreadyListedForSpec
            ? existingIdsForSpec
            : [...existingIdsForSpec, id],
        };
      }
      return {
        servicesById,
        serviceIdsByOrgId,
        serviceIdsBySpecialityId,
      };
    }),

  updateService: (updated) =>
    set((state) => {
      const existing = state.servicesById[updated.id];
      if (!existing) {
        return state;
      }
      const servicesById: Record<string, Service> = {
        ...state.servicesById,
        [updated.id]: {
          ...existing,
          ...updated,
        },
      };
      return { servicesById };
    }),

  getServicesByOrgId: (orgId) => {
    const { servicesById, serviceIdsByOrgId } = get();
    const ids = serviceIdsByOrgId[orgId] ?? [];
    return ids
      .map((id) => servicesById[id])
      .filter((s): s is Service => s != null);
  },

  getServicesBySpecialityId: (specialityId) => {
    const { servicesById, serviceIdsBySpecialityId } = get();
    const ids = serviceIdsBySpecialityId[specialityId] ?? [];
    return ids
      .map((id) => servicesById[id])
      .filter((s): s is Service => s != null);
  },

  clearServices: () =>
    set(() => ({
      servicesById: {},
      serviceIdsByOrgId: {},
      serviceIdsBySpecialityId: {},
    })),
}));
