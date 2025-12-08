import { Speciality } from "@yosemite-crew/types";
import { create } from "zustand";

type SpecialityState = {
  specialitiesById: Record<string, Speciality>;
  specialityIdsByOrgId: Record<string, string[]>;

  setSpecialities: (specialities: Speciality[]) => void;
  addSpeciality: (speciality: Speciality) => void;
  getSpecialitiesByOrgId: (orgId: string) => Speciality[];
  clearSpecialities: () => void;
};

export const useSpecialityStore = create<SpecialityState>()((set, get) => ({
  specialitiesById: {},
  specialityIdsByOrgId: {},

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
        [orgId]: alreadyListed
          ? existingIdsForOrg
          : [...existingIdsForOrg, id],
      };
      return {
        specialitiesById,
        specialityIdsByOrgId,
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
    })),
}));
