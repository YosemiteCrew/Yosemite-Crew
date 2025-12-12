import { create } from "zustand";
import { StoredCompanion } from "../pages/Companions/types";

type CompanionStatus = "idle" | "loading" | "loaded" | "error";

type CompanionState = {
  companionsById: Record<string, StoredCompanion>;
  companionsIdsByOrgId: Record<string, string[]>;
  companionIdsByParentId: Record<string, string[]>;

  status: CompanionStatus;
  error: string | null;
  lastFetchedAt: string | null;

  setCompanions: (items: StoredCompanion[]) => void;
  setCompanionsForOrg: (orgId: string, items: StoredCompanion[]) => void;
  upsertCompanion: (item: StoredCompanion) => void;
  removeCompanion: (id: string) => void;

  getCompanionsByOrgId: (orgId: string) => StoredCompanion[];
  getCompanionsByParentId: (parentId: string) => StoredCompanion[];

  clearCompanions: () => void;
  startLoading: () => void;
  endLoading: () => void;
  setError: (message: string) => void;
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

export const useCompanionStore = create<CompanionState>()((set, get) => ({
  companionsById: {},
  companionsIdsByOrgId: {},
  companionIdsByParentId: {},

  status: "idle",
  error: null,
  lastFetchedAt: null,

  setCompanions: (items) =>
    set(() => {
      const companionsById: Record<string, StoredCompanion> = {};
      const companionsIdsByOrgId: Record<string, string[]> = {};
      const companionIdsByParentId: Record<string, string[]> = {};

      for (const c of items) {
        const id = c.id;
        const orgId = c.organisationId;
        companionsById[id] = c;
        if (!companionsIdsByOrgId[orgId]) {
          companionsIdsByOrgId[orgId] = [];
        }
        companionsIdsByOrgId[orgId].push(id);
        const parentId = (c as any).parentId as string | undefined;
        if (parentId) {
          if (!companionIdsByParentId[parentId]) {
            companionIdsByParentId[parentId] = [];
          }
          companionIdsByParentId[parentId].push(id);
        }
      }
      return {
        companionsById,
        companionsIdsByOrgId,
        companionIdsByParentId,
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  setCompanionsForOrg: (orgId, items) =>
    set((state) => {
      const companionsById = { ...state.companionsById };
      let companionIdsByParentId = { ...state.companionIdsByParentId };
      const existingIds = state.companionsIdsByOrgId[orgId] ?? [];
      for (const id of existingIds) {
        const old = state.companionsById[id];
        if (old) {
          const oldParentId = (old as any).parentId as string | undefined;
          if (oldParentId) {
            companionIdsByParentId = removeFromIndex(
              companionIdsByParentId,
              oldParentId,
              id
            );
          }
        }
        delete companionsById[id];
      }
      const newIds: string[] = [];
      for (const comp of items) {
        const id = comp.id;
        companionsById[id] = comp;
        newIds.push(id);
        const parentId = (comp as any).parentId as string | undefined;
        if (parentId) {
          companionIdsByParentId = addToIndex(
            companionIdsByParentId,
            parentId,
            id
          );
        }
      }
      return {
        companionsById,
        companionsIdsByOrgId: {
          ...state.companionsIdsByOrgId,
          [orgId]: newIds,
        },
        companionIdsByParentId,
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  upsertCompanion: (item) =>
    set((state) => {
      const id = item.id;
      const orgId = item.organisationId;
      const prev = state.companionsById[id];
      const prevParentId = prev
        ? ((prev as any).parentId as string | undefined)
        : undefined;
      const nextParentId = (item as any).parentId as string | undefined;
      const companionsById: Record<string, StoredCompanion> = {
        ...state.companionsById,
        [id]: prev ? { ...prev, ...item } : item,
      };
      const existingOrgIds = state.companionsIdsByOrgId[orgId] ?? [];
      const orgIds = existingOrgIds.includes(id)
        ? existingOrgIds
        : [...existingOrgIds, id];
      let companionIdsByParentId = { ...state.companionIdsByParentId };
      if (prevParentId && prevParentId !== nextParentId) {
        companionIdsByParentId = removeFromIndex(
          companionIdsByParentId,
          prevParentId,
          id
        );
      }
      if (nextParentId && prevParentId !== nextParentId) {
        companionIdsByParentId = addToIndex(
          companionIdsByParentId,
          nextParentId,
          id
        );
      }
      return {
        companionsById,
        companionsIdsByOrgId: {
          ...state.companionsIdsByOrgId,
          [orgId]: orgIds,
        },
        companionIdsByParentId,
        status: "loaded",
        error: null,
      };
    }),

  removeCompanion: (id: string) =>
    set((state) => {
      const companion = state.companionsById[id];
      if (!companion) return state;
      const orgId = companion.organisationId;
      const parentId = (companion as any).parentId as string | undefined;
      const { [id]: _, ...restCompanionsById } = state.companionsById;
      const orgIds = state.companionsIdsByOrgId[orgId] ?? [];
      const filteredOrgIds = orgIds.filter((x) => x !== id);
      let companionIdsByParentId = state.companionIdsByParentId;
      if (parentId) {
        companionIdsByParentId = removeFromIndex(
          { ...state.companionIdsByParentId },
          parentId,
          id
        );
      }
      return {
        companionsById: restCompanionsById,
        companionsIdsByOrgId: {
          ...state.companionsIdsByOrgId,
          [orgId]: filteredOrgIds,
        },
        companionIdsByParentId,
      };
    }),

  getCompanionsByOrgId: (orgId: string) => {
    const { companionsById, companionsIdsByOrgId } = get();
    const ids = companionsIdsByOrgId[orgId] ?? [];
    return ids.map((id) => companionsById[id]).filter(Boolean);
  },

  getCompanionsByParentId: (parentId: string) => {
    const { companionsById, companionIdsByParentId } = get();
    const ids = companionIdsByParentId[parentId] ?? [];
    return ids.map((id) => companionsById[id]).filter(Boolean);
  },

  clearCompanions: () =>
    set(() => ({
      companionsById: {},
      companionsIdsByOrgId: {},
      companionIdsByParentId: {},
      status: "idle",
      error: null,
      lastFetchedAt: null,
    })),

  startLoading: () => set(() => ({ status: "loading", error: null })),

  endLoading: () =>
    set(() => ({
      status: "loaded",
      error: null,
      lastFetchedAt: new Date().toISOString(),
    })),

  setError: (message: string) =>
    set(() => ({ status: "error", error: message })),
}));
