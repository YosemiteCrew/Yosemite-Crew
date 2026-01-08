import { create } from "zustand";
import {
  ApiDayAvailability,
  ApiOverrides,
} from "../components/Availability/utils";

type AvailabilityStatus = "idle" | "loading" | "loaded" | "error";

type AvailabilityState = {
  availabilitiesById: Record<string, ApiDayAvailability>;
  availabilityIdsByOrgId: Record<string, string[]>;

  overridesById: Record<string, ApiOverrides>;
  overrideIdsByOrgId: Record<string, string[]>;

  status: AvailabilityStatus;
  error: string | null;
  lastFetchedAt: string | null;

  setAvailabilities: (items: ApiDayAvailability[]) => void;
  setAvailabilitiesForOrg: (orgId: string, items: ApiDayAvailability[]) => void;
  upsertAvailabilityStore: (item: ApiDayAvailability) => void;
  removeAvailability: (id: string) => void;
  clearAvailabilitiesForOrg: (orgId: string) => void;
  getAvailabilitiesByOrgId: (orgId: string) => ApiDayAvailability[];
  setOverrides: (items: ApiOverrides[]) => void;
  setOverridesForOrg: (orgId: string, items: ApiOverrides[]) => void;
  upsertOverideStore: (item: ApiOverrides) => void;
  removeOverride: (id: string) => void;
  clearAvailabilities: () => void;
  startLoading: () => void;
  endLoading: () => void;
  setError: (message: string) => void;
};

export const useAvailabilityStore = create<AvailabilityState>()((set, get) => ({
  availabilitiesById: {},
  availabilityIdsByOrgId: {},
  overridesById: {},
  overrideIdsByOrgId: {},
  status: "idle",
  error: null,
  lastFetchedAt: null,

  setAvailabilities: (items) =>
    set(() => {
      const availabilitiesById: Record<string, ApiDayAvailability> = {};
      const availabilityIdsByOrgId: Record<string, string[]> = {};
      for (const a of items) {
        const id = a._id;
        const orgId = a.organisationId;
        availabilitiesById[id] = { ...a, _id: id };
        if (!availabilityIdsByOrgId[orgId]) {
          availabilityIdsByOrgId[orgId] = [];
        }
        availabilityIdsByOrgId[orgId].push(id);
      }
      return {
        availabilitiesById,
        availabilityIdsByOrgId,
        status: "loaded",
        lastFetchedAt: new Date().toISOString(),
        error: null,
      };
    }),

  setAvailabilitiesForOrg: (orgId, items) =>
    set((state) => {
      const availabilitiesById = { ...state.availabilitiesById };
      const existingIds = state.availabilityIdsByOrgId[orgId] ?? [];
      for (const id of existingIds) {
        delete availabilitiesById[id];
      }
      const newIds: string[] = [];
      for (const item of items) {
        const id = item._id;
        availabilitiesById[id] = item;
        newIds.push(id);
      }
      const availabilityIdsByOrgId = {
        ...state.availabilityIdsByOrgId,
        [orgId]: newIds,
      };
      return {
        availabilitiesById,
        availabilityIdsByOrgId,
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  upsertAvailabilityStore: (item) =>
    set((state) => {
      const id = item._id; // required
      const orgId = item.organisationId;
      const exists = !!state.availabilitiesById[id];
      const availabilitiesById: Record<string, ApiDayAvailability> = {
        ...state.availabilitiesById,
        [id]: exists ? { ...state.availabilitiesById[id], ...item } : item,
      };
      const existingIds = state.availabilityIdsByOrgId[orgId] ?? [];
      const ids = existingIds.includes(id) ? existingIds : [...existingIds, id];
      const availabilityIdsByOrgId = {
        ...state.availabilityIdsByOrgId,
        [orgId]: ids,
      };
      return {
        availabilitiesById,
        availabilityIdsByOrgId,
        status: "loaded",
        error: null,
      };
    }),

  getAvailabilitiesByOrgId: (orgId: string) => {
    const { availabilitiesById, availabilityIdsByOrgId } = get();
    const ids = availabilityIdsByOrgId[orgId] ?? [];
    return ids
      .map((id) => availabilitiesById[id])
      .filter((a): a is ApiDayAvailability => a != null);
  },

  removeAvailability: (id: string) =>
    set((state) => {
      const removed = state.availabilitiesById[id];
      if (!removed) return state;
      const orgId = removed.organisationId;
      const { [id]: _, ...restAvailabilitiesById } = state.availabilitiesById;
      const availabilityIdsByOrgId = {
        ...state.availabilityIdsByOrgId,
        [orgId]:
          state.availabilityIdsByOrgId[orgId]?.filter((x) => x !== id) ?? [],
      };
      return {
        availabilitiesById: restAvailabilitiesById,
        availabilityIdsByOrgId,
      };
    }),

  clearAvailabilitiesForOrg: (orgId: string) =>
    set((state) => {
      const ids = state.availabilityIdsByOrgId[orgId] ?? [];
      if (!ids.length) {
        const { [orgId]: _, ...restIds } = state.availabilityIdsByOrgId;
        return { availabilityIdsByOrgId: restIds };
      }
      const availabilitiesById = { ...state.availabilitiesById };
      for (const id of ids) delete availabilitiesById[id];
      const { [orgId]: _, ...restIds } = state.availabilityIdsByOrgId;
      return {
        availabilitiesById,
        availabilityIdsByOrgId: restIds,
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  clearAvailabilities: () =>
    set(() => ({
      availabilitiesById: {},
      availabilityIdsByOrgId: {},
      status: "idle",
      error: null,
      lastFetchedAt: null,
    })),

  setOverrides: (items) =>
    set((state) => {
      const overridesById: Record<string, ApiOverrides> = {};
      const overrideIdsByOrgId: Record<string, string[]> = {};
      for (const o of items) {
        const id = o._id;
        const orgId = o.organisationId;
        overridesById[id] = { ...o, _id: id };
        if (!overrideIdsByOrgId[orgId]) overrideIdsByOrgId[orgId] = [];
        overrideIdsByOrgId[orgId].push(id);
      }
      return {
        ...state,
        overridesById,
        overrideIdsByOrgId,
        status: "loaded",
        error: null,
      };
    }),

  setOverridesForOrg: (orgId, items) =>
    set((state) => {
      const overridesById = { ...state.overridesById };
      const existingIds = state.overrideIdsByOrgId[orgId] ?? [];
      for (const id of existingIds) delete overridesById[id];
      const newIds: string[] = [];
      for (const item of items) {
        const id = item._id;
        overridesById[id] = item;
        newIds.push(id);
      }
      return {
        ...state,
        overridesById,
        overrideIdsByOrgId: {
          ...state.overrideIdsByOrgId,
          [orgId]: newIds,
        },
        status: "loaded",
        error: null,
      };
    }),

  upsertOverideStore: (item) =>
    set((state) => {
      const id = item._id;
      const orgId = item.organisationId;
      const exists = !!state.overridesById[id];
      const overridesById: Record<string, ApiOverrides> = {
        ...state.overridesById,
        [id]: exists ? { ...state.overridesById[id], ...item } : item,
      };
      const existingIds = state.overrideIdsByOrgId[orgId] ?? [];
      const ids = existingIds.includes(id) ? existingIds : [...existingIds, id];
      const overrideIdsByOrgId = {
        ...state.overrideIdsByOrgId,
        [orgId]: ids,
      };
      return {
        overridesById,
        overrideIdsByOrgId,
        status: "loaded",
        error: null,
      };
    }),

  removeOverride: (id: string) =>
    set((state) => {
      const removed = state.overridesById[id];
      if (!removed) return state;
      const orgId = removed.organisationId;
      const { [id]: _, ...restAvailabilitiesById } = state.overridesById;
      const overrideIdsByOrgId = {
        ...state.overrideIdsByOrgId,
        [orgId]: state.overrideIdsByOrgId[orgId]?.filter((x) => x !== id) ?? [],
      };
      return {
        overridesById: restAvailabilitiesById,
        overrideIdsByOrgId,
      };
    }),

  startLoading: () =>
    set(() => ({
      status: "loading",
      error: null,
    })),

  endLoading: () =>
    set(() => ({
      status: "loaded",
      error: null,
      lastFetchedAt: new Date().toISOString(),
    })),

  setError: (message: string) =>
    set(() => ({
      status: "error",
      error: message,
    })),
}));
