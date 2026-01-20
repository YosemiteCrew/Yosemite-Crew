import { useCallback, useEffect, useMemo } from "react";
import {
  createInventoryBatch,
  createInventoryItem,
  fetchInventoryItems,
  fetchInventoryTurnover,
  hideInventoryItem,
  unhideInventoryItem,
  updateInventoryItem,
} from "@/app/services/inventoryService";
import {
  BatchValues,
  InventoryApiItem,
  InventoryBatchApi,
  InventoryItem,
  InventoryTurnoverItem,
} from "@/app/pages/Inventory/types";
import {
  buildBatchPayload,
  buildInventoryPayload,
  mapApiItemToInventoryItem,
} from "@/app/pages/Inventory/utils";
import { useInventoryStore } from "@/app/stores/inventoryStore";
import { useOrgStore } from "@/app/stores/orgStore";
import { BusinessType } from "@/app/types/org";

const withBusinessType = (
  item: InventoryItem,
  fallback: BusinessType
): InventoryItem => ({
  ...item,
  businessType: item.businessType ?? fallback,
});

const EMPTY_INVENTORY: InventoryItem[] = [];
const EMPTY_TURNOVER: InventoryTurnoverItem[] = [];
const EMPTY_IDS: string[] = [];
const inFlightLoads: Record<string, Promise<any> | undefined> = {};

export const useInventoryModule = (businessType: BusinessType) => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const itemsById = useInventoryStore((s) => s.itemsById);
  const inventoryIds = useInventoryStore(
    (s) => (primaryOrgId ? s.itemIdsByOrgId[primaryOrgId] : undefined) ?? EMPTY_IDS
  );
  const turnoverFromStore = useInventoryStore(
    (s) => (primaryOrgId ? s.turnoverByOrgId[primaryOrgId] : undefined)
  );

  const inventory = useMemo(
    () =>
      inventoryIds
        .map((id) => itemsById[id])
        .filter((x): x is InventoryItem => x != null),
    [inventoryIds, itemsById]
  );
  const turnover = turnoverFromStore ?? EMPTY_TURNOVER;

  const status = useInventoryStore(
    (s) => s.statusByOrgId[primaryOrgId ?? ""] ?? "idle"
  );
  const loadError = useInventoryStore(
    (s) => s.errorByOrgId[primaryOrgId ?? ""] ?? null
  );
  const lastFetched = useInventoryStore(
    (s) => s.lastFetchedByOrgId[primaryOrgId ?? ""] ?? null
  );

  const setInventoryForOrg = useInventoryStore((s) => s.setInventoryForOrg);
  const setTurnoverForOrg = useInventoryStore((s) => s.setTurnoverForOrg);
  const upsertInventory = useInventoryStore((s) => s.upsertInventory);
  const startLoading = useInventoryStore((s) => s.startLoading);
  const setError = useInventoryStore((s) => s.setError);

  const mergeApiWithExistingBatches = (
    apiItem: InventoryApiItem,
    existing?: InventoryItem
  ): InventoryApiItem => {
    if (apiItem.batches && apiItem.batches.length > 0) return apiItem;
    if (!existing?.batches?.length) return apiItem;
    const mergedBatches: InventoryBatchApi[] = existing.batches.map((b) => ({
      batchNumber: b.batch,
      lotNumber: b.serial,
      regulatoryTrackingId: b.tracking,
      manufactureDate: b.manufactureDate,
      expiryDate: b.expiryDate,
      minShelfLifeAlertDate: b.minShelfLifeAlertDate ?? b.nextRefillDate,
      quantity: Number.isFinite(Number(b.quantity)) ? Number(b.quantity) : undefined,
      allocated: Number.isFinite(Number(b.allocated)) ? Number(b.allocated) : undefined,
      _id: b._id,
      itemId: b.itemId ?? apiItem._id,
      organisationId: b.organisationId ?? apiItem.organisationId,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }));
    return { ...apiItem, batches: mergedBatches };
  };

  const loadInventory = useCallback(
    async (orgId?: string) => {
      const organisationId = orgId ?? primaryOrgId;
      if (!organisationId) return;
      if (inFlightLoads[organisationId] !== undefined) {
        return inFlightLoads[organisationId];
      }
      startLoading(organisationId);
      inFlightLoads[organisationId] = (async () => {
        try {
          const [items, turnoverItems] = await Promise.all([
            fetchInventoryItems(organisationId),
            fetchInventoryTurnover(organisationId),
          ]);
          const mapped = items.map((item) =>
            withBusinessType(mapApiItemToInventoryItem(item), businessType)
          );
          setInventoryForOrg(organisationId, mapped);
          setTurnoverForOrg(organisationId, turnoverItems);
          return { items: mapped, turnover: turnoverItems };
        } catch (err) {
          setError(organisationId, "Unable to load inventory right now.");
          throw err;
        } finally {
          delete inFlightLoads[organisationId];
        }
      })();
      return inFlightLoads[organisationId];
    },
    [
      primaryOrgId,
      businessType,
      startLoading,
      setInventoryForOrg,
      setTurnoverForOrg,
      setError,
    ]
  );

  useEffect(() => {
    if (!primaryOrgId) return;
    if (status === "loading") return;
    if (status === "error" && lastFetched) return;
    if (lastFetched) return;
    void loadInventory(primaryOrgId);
  }, [primaryOrgId, status, lastFetched, loadInventory]);

  const createItem = useCallback(
    async (data: InventoryItem) => {
      if (!primaryOrgId) throw new Error("No organisation selected.");
      const payload = buildInventoryPayload(data, primaryOrgId, businessType);
      const created = await createInventoryItem(payload);
      const mapped = withBusinessType(
        mapApiItemToInventoryItem(created),
        businessType
      );
      upsertInventory(mapped);
      return mapped;
    },
    [primaryOrgId, businessType, upsertInventory]
  );

  const updateItem = useCallback(
    async (item: InventoryItem) => {
      if (!primaryOrgId || !item.id) {
        throw new Error("No organisation selected.");
      }
      const payload = buildInventoryPayload(
        item,
        primaryOrgId,
        item.businessType ?? businessType
      );
      const res = await updateInventoryItem(item.id, payload);
      const mapped = withBusinessType(
        mapApiItemToInventoryItem(res),
        businessType
      );
      upsertInventory(mapped);
      return mapped;
    },
    [primaryOrgId, businessType, upsertInventory]
  );

  const hideItem = useCallback(
    async (itemId: string) => {
      if (!itemId) throw new Error("No inventory item to hide.");
      const res = await hideInventoryItem(itemId);
      if (res) {
        const withBatches = mergeApiWithExistingBatches(res, itemsById[itemId]);
        const mapped = withBusinessType(
          mapApiItemToInventoryItem(withBatches),
          businessType
        );
        upsertInventory(mapped);
        return mapped;
      }
      const organisationId = primaryOrgId;
      if (organisationId) {
        await loadInventory(organisationId);
      }
    },
    [businessType, primaryOrgId, upsertInventory, loadInventory, itemsById]
  );

  const unhideItem = useCallback(
    async (itemId: string) => {
      if (!itemId) throw new Error("No inventory item to unhide.");
      const res = await unhideInventoryItem(itemId);
      if (res) {
        const withBatches = mergeApiWithExistingBatches(res, itemsById[itemId]);
        const mapped = withBusinessType(
          mapApiItemToInventoryItem(withBatches),
          businessType
        );
        upsertInventory(mapped);
        return mapped;
      }
      const organisationId = primaryOrgId;
      if (organisationId) {
        await loadInventory(organisationId);
      }
    },
    [businessType, primaryOrgId, upsertInventory, loadInventory, itemsById]
  );

  const addBatch = useCallback(
    async (itemId: string, batches: BatchValues[]) => {
      if (!itemId) throw new Error("No inventory item to update.");
      if (!primaryOrgId) throw new Error("No organisation selected.");
      const payloads = batches
        .map((b) =>
          buildBatchPayload({
            ...b,
            itemId,
            organisationId: primaryOrgId,
          } as any)
        )
        .filter(Boolean);
      if (!payloads.length) return;
      await Promise.all(
        payloads.map((payload) => createInventoryBatch(itemId, payload!))
      );
      await loadInventory(primaryOrgId);
    },
    [primaryOrgId, loadInventory]
  );

  return {
    inventory,
    turnover,
    status,
    error: loadError,
    loadInventory,
    createItem,
    updateItem,
    hideItem,
    unhideItem,
    addBatch,
  } satisfies {
    inventory: InventoryItem[];
    turnover: InventoryTurnoverItem[];
    status: string;
    error: string | null;
    loadInventory: (orgId?: string) => Promise<
      | {
          items: InventoryItem[];
          turnover: InventoryTurnoverItem[];
        }
      | void
    >;
    createItem: (item: InventoryItem) => Promise<InventoryItem>;
    updateItem: (item: InventoryItem) => Promise<InventoryItem>;
    hideItem: (itemId: string) => Promise<InventoryItem | void>;
    unhideItem: (itemId: string) => Promise<InventoryItem | void>;
    addBatch: (itemId: string, batches: BatchValues[]) => Promise<void>;
  };
};
