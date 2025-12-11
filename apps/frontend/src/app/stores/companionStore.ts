import { Companion } from "@yosemite-crew/types";
import { create } from "zustand";

type CompanionStatus = "idle" | "loading" | "loaded" | "error";

export type StoredCompanion = Companion & {
  id: string;
  organisationId: string;
};

type CompanionState = {
  companionsById: Record<string, StoredCompanion>;
  companionsIdsByOrgId: Record<string, string[]>;

  status: CompanionStatus;
  error: string | null;
  lastFetchedAt: string | null;

  setCompanions: (items: StoredCompanion[]) => void;
  setCompanionsForOrg: (orgId: string, items: StoredCompanion[]) => void;
  upsertCompanion: (item: StoredCompanion) => void;
  removeCompanion: (id: string) => void;
  getCompanionsByOrgId: (orgId: string) => StoredCompanion[];

  clearCompanions: () => void;
  startLoading: () => void;
  endLoading: () => void;
  setError: (message: string) => void;
};

export const useCompanionStore = create<CompanionState>()((set, get) => ({
  companionsById: {},
  companionsIdsByOrgId: {},

  status: "idle",
  error: null,
  lastFetchedAt: null,

  setCompanions: (items) =>
    set(() => {
      const companionsById: Record<string, StoredCompanion> = {};
      const companionsIdsByOrgId: Record<string, string[]> = {};
      for (const c of items) {
        const id = c.id;
        const orgId = c.organisationId;
        companionsById[id] = c;
        if (!companionsIdsByOrgId[orgId]) {
          companionsIdsByOrgId[orgId] = [];
        }
        companionsIdsByOrgId[orgId].push(id);
      }
      return {
        companionsById,
        companionsIdsByOrgId,
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  setCompanionsForOrg: (orgId, items) =>
    set((state) => {
      const companionsById = { ...state.companionsById };
      const existingIds = state.companionsIdsByOrgId[orgId] ?? [];
      for (const id of existingIds) {
        delete companionsById[id];
      }
      const newIds: string[] = [];
      for (const comp of items) {
        const id = comp.id;
        companionsById[id] = comp;
        newIds.push(id);
      }
      const companionsIdsByOrgId = {
        ...state.companionsIdsByOrgId,
        [orgId]: newIds,
      };
      return {
        companionsById,
        companionsIdsByOrgId,
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  upsertCompanion: (item) =>
    set((state) => {
      const id = item.id;
      const orgId = item.organisationId;
      const exists = !!state.companionsById[id];
      const companionsById: Record<string, StoredCompanion> = {
        ...state.companionsById,
        [id]: exists ? { ...state.companionsById[id], ...item } : item,
      };
      const existingIds = state.companionsIdsByOrgId[orgId] ?? [];
      const ids = existingIds.includes(id) ? existingIds : [...existingIds, id];
      const companionsIdsByOrgId = {
        ...state.companionsIdsByOrgId,
        [orgId]: ids,
      };
      return {
        companionsById,
        companionsIdsByOrgId,
        status: "loaded",
        error: null,
      };
    }),

  removeCompanion: (id: string) =>
    set((state) => {
      const companion = state.companionsById[id];
      if (!companion) return state;
      const orgId = companion.organisationId;
      const { [id]: _, ...restCompanionsById } = state.companionsById;
      const orgIds = state.companionsIdsByOrgId[orgId] ?? [];
      const filteredIds = orgIds.filter((companionId) => companionId !== id);
      const companionsIdsByOrgId = {
        ...state.companionsIdsByOrgId,
        [orgId]: filteredIds,
      };
      return {
        companionsById: restCompanionsById,
        companionsIdsByOrgId,
      };
    }),

  getCompanionsByOrgId: (orgId: string) => {
    const { companionsById, companionsIdsByOrgId } = get();
    const ids = companionsIdsByOrgId[orgId] ?? [];
    return ids
      .map((id) => companionsById[id])
      .filter((c): c is StoredCompanion => c != null);
  },

  clearCompanions: () =>
    set(() => ({
      companionsById: {},
      companionsIdsByOrgId: {},
      status: "idle",
      error: null,
      lastFetchedAt: null,
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
      lastFetchedAt: new Date().toISOString(),
    })),

  setError: (message: string) =>
    set(() => ({
      status: "error",
      error: message,
    })),
}));
