import { create } from "zustand";
import { StoredParent } from "../pages/Companions/types";

type ParentStatus = "idle" | "loading" | "loaded" | "error";

type ParentState = {
  parentsById: Record<string, StoredParent>;
  parentIds: string[];

  status: ParentStatus;
  error: string | null;
  lastFetchedAt: string | null;

  setParents: (items: StoredParent[]) => void;
  upsertParent: (item: StoredParent) => void;
  addBulkParents: (items: StoredParent[]) => void;
  removeParent: (id: string) => void;

  getAllParents: () => StoredParent[];
  getParentById: (id: string) => StoredParent | null;

  clearParents: () => void;
  startLoading: () => void;
  endLoading: () => void;
  setError: (message: string) => void;
};

export const useParentStore = create<ParentState>()((set, get) => ({
  parentsById: {},
  parentIds: [],

  status: "idle",
  error: null,
  lastFetchedAt: null,

  setParents: (items) =>
    set(() => {
      const parentsById: Record<string, StoredParent> = {};
      const parentIds: string[] = [];
      for (const p of items) {
        const id = p.id;
        parentsById[id] = p;
        parentIds.push(id);
      }
      const uniqueParentIds = Array.from(new Set(parentIds));
      return {
        parentsById,
        parentIds: uniqueParentIds,
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  upsertParent: (item) =>
    set((state) => {
      const id = item.id;
      const exists = !!state.parentsById[id];
      return {
        parentsById: {
          ...state.parentsById,
          [id]: exists ? { ...state.parentsById[id], ...item } : item,
        },
        parentIds: state.parentIds.includes(id)
          ? state.parentIds
          : [...state.parentIds, id],
        status: "loaded",
        error: null,
      };
    }),

  addBulkParents: (items) =>
    set((state) => {
      const parentsById = { ...state.parentsById };
      const parentIds = new Set(state.parentIds);
      for (const p of items) {
        const id = p.id;
        if (parentsById[id]) {
          parentsById[id] = {
            ...parentsById[id],
            ...p,
          };
        } else {
          parentsById[id] = p;
          parentIds.add(id);
        }
      }
      return {
        parentsById,
        parentIds: Array.from(parentIds),
        status: "loaded",
        error: null,
      };
    }),

  removeParent: (id: string) =>
    set((state) => {
      const { [id]: _, ...restParentsById } = state.parentsById;
      return {
        parentsById: restParentsById,
        parentIds: state.parentIds.filter((pid) => pid !== id),
      };
    }),

  getAllParents: () => {
    const { parentsById, parentIds } = get();
    return parentIds.map((id) => parentsById[id]).filter(Boolean);
  },

  getParentById: (id: string) => {
    const { parentsById } = get();
    return parentsById[id] ?? null;
  },

  clearParents: () =>
    set(() => ({
      parentsById: {},
      parentIds: [],
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
    set(() => ({
      status: "error",
      error: message,
    })),
}));
