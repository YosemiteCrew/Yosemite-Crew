import { Service } from "@yosemite-crew/types";
import { create } from "zustand";

type ServiceState = {
  servicesById: Record<string, Service>;
  serviceIdsByOrgId: Record<string, string[]>;
  serviceIdsBySpecialityId: Record<string, string[]>;

  setServices: (services: Service[]) => void;
  setServicesForOrg: (orgId: string, items: Service[]) => void;
  addService: (service: Service) => void;
  updateService: (updated: Service) => void;
  clearServicesForOrg: (orgId: string) => void;
  getServicesByOrgId: (orgId: string) => Service[];
  getServicesBySpecialityId: (specialityId: string) => Service[];
  clearServices: () => void;
};

const addToIndex = (idx: Record<string, string[]>, key: string, id: string) => {
  const arr = idx[key] ?? [];
  if (arr.includes(id)) return idx;
  return { ...idx, [key]: [...arr, id] };
};

const removeFromIndex = (
  idx: Record<string, string[]>,
  key: string,
  id: string
) => {
  const arr = idx[key] ?? [];
  if (!arr.length) return idx;
  return { ...idx, [key]: arr.filter((x) => x !== id) };
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

  setServicesForOrg: (orgId, items) =>
    set((state) => {
      const servicesById = { ...state.servicesById };
      let serviceIdsBySpecialityId = { ...state.serviceIdsBySpecialityId };
      const existingIds = state.serviceIdsByOrgId[orgId] ?? [];
      for (const id of existingIds) {
        const old = state.servicesById[id];
        if (old) {
          const oldSpecialityId = old.specialityId;
          if (oldSpecialityId) {
            serviceIdsBySpecialityId = removeFromIndex(
              serviceIdsBySpecialityId,
              oldSpecialityId,
              id
            );
          }
        }
        delete servicesById[id];
      }
      const newIds: string[] = [];
      for (const service of items) {
        const id = service.id;
        servicesById[id] = service;
        newIds.push(id);
        const specialityId = service.specialityId;
        if (specialityId) {
          serviceIdsBySpecialityId = addToIndex(
            serviceIdsBySpecialityId,
            specialityId,
            id
          );
        }
      }
      return {
        servicesById,
        serviceIdsByOrgId: {
          ...state.serviceIdsByOrgId,
          [orgId]: newIds,
        },
        serviceIdsBySpecialityId
      };
    }),

  clearServicesForOrg: (orgId: string) =>
    set((state) => {
      const ids = state.serviceIdsByOrgId[orgId] ?? [];
      if (!ids.length) {
        const { [orgId]: _, ...restOrgIdx } = state.serviceIdsByOrgId;
        return { serviceIdsByOrgId: restOrgIdx };
      }
      const servicesById = { ...state.servicesById };
      for (const id of ids) delete servicesById[id];
      const { [orgId]: _, ...restOrgIdx } = state.serviceIdsByOrgId;
      const idSet = new Set(ids);
      const serviceIdsBySpecialityId: Record<string, string[]> = {};
      for (const [specId, specIds] of Object.entries(
        state.serviceIdsBySpecialityId
      )) {
        const next = specIds.filter((sid) => !idSet.has(sid));
        if (next.length) serviceIdsBySpecialityId[specId] = next;
      }
      return {
        servicesById,
        serviceIdsByOrgId: restOrgIdx,
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
