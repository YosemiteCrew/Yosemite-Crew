import { create } from "zustand";
import {
  InventoryItem,
  InventoryTurnoverItem,
} from "@/app/pages/Inventory/types";

type InventoryStatus = "idle" | "loading" | "loaded" | "error";

type InventoryState = {
  itemsById: Record<string, InventoryItem>;
  itemIdsByOrgId: Record<string, string[]>;
  turnoverByOrgId: Record<string, InventoryTurnoverItem[]>;
  statusByOrgId: Record<string, InventoryStatus>;
  errorByOrgId: Record<string, string | null>;
  lastFetchedByOrgId: Record<string, string | null>;

  setInventoryForOrg: (orgId: string, items: InventoryItem[]) => void;
  upsertInventory: (item: InventoryItem) => void;
  removeInventory: (id: string, orgId?: string) => void;
  setTurnoverForOrg: (orgId: string, items: InventoryTurnoverItem[]) => void;

  getInventoryByOrgId: (orgId: string) => InventoryItem[];
  getTurnoverByOrgId: (orgId: string) => InventoryTurnoverItem[];

  startLoading: (orgId: string) => void;
  markLoaded: (orgId: string) => void;
  setError: (orgId: string, message: string) => void;
  clearOrg: (orgId: string) => void;
  clearAll: () => void;
};

const withStatus = (
  statusByOrgId: Record<string, InventoryStatus>,
  orgId: string,
  status: InventoryStatus
) => ({
  ...statusByOrgId,
  [orgId]: status,
});

const withError = (
  errorByOrgId: Record<string, string | null>,
  orgId: string,
  error: string | null
) => ({
  ...errorByOrgId,
  [orgId]: error,
});

const withTimestamp = (
  lastFetchedByOrgId: Record<string, string | null>,
  orgId: string
) => ({
  ...lastFetchedByOrgId,
  [orgId]: new Date().toISOString(),
});

export const useInventoryStore = create<InventoryState>()((set, get) => ({
  itemsById: {},
  itemIdsByOrgId: {},
  turnoverByOrgId: {},
  statusByOrgId: {},
  errorByOrgId: {},
  lastFetchedByOrgId: {},

  setInventoryForOrg: (orgId, items) =>
    set((state) => {
      const itemsById = { ...state.itemsById };
      const existingIds = state.itemIdsByOrgId[orgId] ?? [];
      for (const id of existingIds) {
        delete itemsById[id];
      }

      const nextIds: string[] = [];
      for (const item of items) {
        const id = item.id ?? item.basicInfo?.name;
        if (!id) continue;
        itemsById[id] = { ...item, id };
        nextIds.push(id);
      }

      return {
        itemsById,
        itemIdsByOrgId: { ...state.itemIdsByOrgId, [orgId]: nextIds },
        statusByOrgId: withStatus(state.statusByOrgId, orgId, "loaded"),
        errorByOrgId: withError(state.errorByOrgId, orgId, null),
        lastFetchedByOrgId: withTimestamp(state.lastFetchedByOrgId, orgId),
      };
    }),

  upsertInventory: (item) =>
    set((state) => {
      const id = item.id ?? item.basicInfo?.name;
      const orgId = item.organisationId;
      if (!id || !orgId) return state;
      const existing = state.itemsById[id];
      const itemsById = {
        ...state.itemsById,
        [id]: existing ? { ...existing, ...item, id } : { ...item, id },
      };
      const currentIds = state.itemIdsByOrgId[orgId] ?? [];
      const itemIds = currentIds.includes(id)
        ? currentIds
        : [...currentIds, id];

      return {
        itemsById,
        itemIdsByOrgId: { ...state.itemIdsByOrgId, [orgId]: itemIds },
        statusByOrgId: withStatus(state.statusByOrgId, orgId, "loaded"),
        errorByOrgId: withError(state.errorByOrgId, orgId, null),
      };
    }),

  removeInventory: (id, orgId) =>
    set((state) => {
      if (!state.itemsById[id]) return state;
      const nextItems = { ...state.itemsById };
      delete nextItems[id];
      let itemIdsByOrgId = state.itemIdsByOrgId;
      if (orgId) {
        const ids = state.itemIdsByOrgId[orgId] ?? [];
        itemIdsByOrgId = {
          ...state.itemIdsByOrgId,
          [orgId]: ids.filter((x) => x !== id),
        };
      }
      return {
        itemsById: nextItems,
        itemIdsByOrgId,
      };
    }),

  setTurnoverForOrg: (orgId, items) =>
    set((state) => ({
      turnoverByOrgId: { ...state.turnoverByOrgId, [orgId]: items },
      statusByOrgId: withStatus(state.statusByOrgId, orgId, "loaded"),
      errorByOrgId: withError(state.errorByOrgId, orgId, null),
      lastFetchedByOrgId: withTimestamp(state.lastFetchedByOrgId, orgId),
    })),

  getInventoryByOrgId: (orgId) => {
    const { itemsById, itemIdsByOrgId } = get();
    const ids = itemIdsByOrgId[orgId] ?? [];
    return ids.map((id) => itemsById[id]).filter(Boolean);
  },

  getTurnoverByOrgId: (orgId) => {
    const { turnoverByOrgId } = get();
    return turnoverByOrgId[orgId] ?? [];
  },

  startLoading: (orgId) =>
    set((state) => ({
      statusByOrgId: withStatus(state.statusByOrgId, orgId, "loading"),
      errorByOrgId: withError(state.errorByOrgId, orgId, null),
    })),

  markLoaded: (orgId) =>
    set((state) => ({
      statusByOrgId: withStatus(state.statusByOrgId, orgId, "loaded"),
      errorByOrgId: withError(state.errorByOrgId, orgId, null),
      lastFetchedByOrgId: withTimestamp(state.lastFetchedByOrgId, orgId),
    })),

  setError: (orgId, message) =>
    set((state) => ({
      statusByOrgId: withStatus(state.statusByOrgId, orgId, "error"),
      errorByOrgId: withError(state.errorByOrgId, orgId, message),
      // Prevent immediate retry loops when API returns errors (e.g., 429)
      lastFetchedByOrgId: withTimestamp(state.lastFetchedByOrgId, orgId),
    })),

  clearOrg: (orgId) =>
    set((state) => {
      const { [orgId]: _a, ...restIds } = state.itemIdsByOrgId;
      const { [orgId]: _b, ...restTurnover } = state.turnoverByOrgId;
      const { [orgId]: _c, ...restStatus } = state.statusByOrgId;
      const { [orgId]: _d, ...restError } = state.errorByOrgId;
      const { [orgId]: _e, ...restFetched } = state.lastFetchedByOrgId;
      return {
        itemIdsByOrgId: restIds,
        turnoverByOrgId: restTurnover,
        statusByOrgId: restStatus,
        errorByOrgId: restError,
        lastFetchedByOrgId: restFetched,
      };
    }),

  clearAll: () =>
    set(() => ({
      itemsById: {},
      itemIdsByOrgId: {},
      turnoverByOrgId: {},
      statusByOrgId: {},
      errorByOrgId: {},
      lastFetchedByOrgId: {},
    })),
}));
