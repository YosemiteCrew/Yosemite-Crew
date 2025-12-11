import { Speciality } from "@yosemite-crew/types";
import { create } from "zustand";

type SpecialityStatus = "idle" | "loading" | "loaded" | "error";

type SpecialityState = {
  specialitiesById: Record<string, Speciality>;
  specialityIdsByOrgId: Record<string, string[]>;

  status: SpecialityStatus;
  error: string | null;
  lastFetchedAt: string | null;

  setSpecialities: (specialities: Speciality[]) => void;
  addSpeciality: (speciality: Speciality) => void;
  updateSpeciality: (speciality: Speciality) => void;
  getSpecialitiesByOrgId: (orgId: string) => Speciality[];
  clearSpecialities: () => void;
  startLoading: () => void;
  endLoading: () => void;
  setError: (message: string) => void;
};

export const useSpecialityStore = create<SpecialityState>()((set, get) => ({
  specialitiesById: {},
  specialityIdsByOrgId: {},
  status: "idle",
  error: null,
  lastFetchedAt: null,

  setSpecialities: (specialities) =>
    set(() => {
      const specialitiesById: Record<string, Speciality> = {};
      const specialityIdsByOrgId: Record<string, string[]> = {};
      for (const spec of specialities) {
        const id = spec._id ?? crypto.randomUUID();
        const orgId = spec.organisationId;
        specialitiesById[id] = { ...spec, _id: id };
        if (!specialityIdsByOrgId[orgId]) {
          specialityIdsByOrgId[orgId] = [];
        }
        specialityIdsByOrgId[orgId].push(id);
      }
      return {
        specialitiesById,
        specialityIdsByOrgId,
        status: "loaded",
      };
    }),

  addSpeciality: (speciality) =>
    set((state) => {
      const id = speciality._id ?? crypto.randomUUID();
      const orgId = speciality.organisationId;
      const specialitiesById: Record<string, Speciality> = {
        ...state.specialitiesById,
        [id]: { ...speciality, _id: id },
      };
      const existingIdsForOrg = state.specialityIdsByOrgId[orgId] ?? [];
      const alreadyListed = existingIdsForOrg.includes(id);
      const specialityIdsByOrgId: Record<string, string[]> = {
        ...state.specialityIdsByOrgId,
        [orgId]: alreadyListed ? existingIdsForOrg : [...existingIdsForOrg, id],
      };
      return {
        specialitiesById,
        specialityIdsByOrgId,
        status: "loaded",
      };
    }),

  updateSpeciality: (updated) =>
    set((state) => {
      const id = updated._id;
      if (!id || !state.specialitiesById[id]) {
        console.warn("updateSpeciality: speciality not found:", updated);
        return state;
      }
      return {
        specialitiesById: {
          ...state.specialitiesById,
          [id]: {
            ...state.specialitiesById[id],
            ...updated,
          },
        },
        status: "loaded",
      };
    }),

  getSpecialitiesByOrgId: (orgId) => {
    const { specialitiesById, specialityIdsByOrgId } = get();
    const ids = specialityIdsByOrgId[orgId] ?? [];
    return ids
      .map((id) => specialitiesById[id])
      .filter((s): s is Speciality => s != null);
  },

  clearSpecialities: () =>
    set(() => ({
      specialitiesById: {},
      specialityIdsByOrgId: {},
      status: "idle",
      error: null
    })),

  startLoading: () =>
    set(() => ({
      status: "loading",
      error: null,
    })),

  endLoading: () =>
    set(() => ({
      status: "loaded",
      error: null,
    })),

  setError: (message: string) =>
    set(() => ({
      status: "error",
      error: message,
    })),
}));
