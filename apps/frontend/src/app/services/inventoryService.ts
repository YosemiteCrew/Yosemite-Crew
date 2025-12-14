import axios from "axios";
import {
  getData,
  patchData,
  postData,
} from "@/app/services/axios";
import {
  InventoryApiItem,
  InventoryRequestPayload,
  InventoryTurnoverItem,
  InventoryBatchApi,
  InventoryBatchPayload,
} from "@/app/pages/Inventory/types";

const stripEmpty = (
  params: Record<string, string | number | undefined>
) =>
  Object.entries(params).reduce<Record<string, string | number>>(
    (acc, [key, value]) => {
      if (value === undefined || value === "") return acc;
      acc[key] = value;
      return acc;
    },
    {}
  );

const normalizeInventoryResponse = (
  data: InventoryApiItem | { item: InventoryApiItem; batches?: InventoryBatchApi[] }
): InventoryApiItem => {
  if ((data as any)?.item) {
    const payload = data as { item: InventoryApiItem; batches?: InventoryBatchApi[] };
    return { ...payload.item, batches: payload.batches ?? payload.item.batches };
  }
  return data as InventoryApiItem;
};

export const fetchInventoryItems = async (
  organisationId: string,
  params: Record<string, string | number | undefined> = {}
): Promise<InventoryApiItem[]> => {
  try {
    const res = await getData<InventoryApiItem[]>(
      `/v1/inventory/organisation/${organisationId}/items`,
      stripEmpty(params)
    );
    if (!Array.isArray(res.data)) {
      console.warn("Inventory list response is not an array", res.data);
      return [];
    }
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error(
        "Failed to load inventory items:",
        err.response?.data?.message ?? err.message
      );
    } else {
      console.error("Failed to load inventory items:", err);
    }
    throw err;
  }
};

export const createInventoryItem = async (
  payload: InventoryRequestPayload
) => {
  try {
    const res = await postData<
      InventoryApiItem | { item: InventoryApiItem; batches?: InventoryBatchApi[] }
    >("/v1/inventory/items", payload);
    return normalizeInventoryResponse(res.data);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error(
        "Failed to create inventory item:",
        err.response?.data?.message ?? err.message
      );
    } else {
      console.error("Failed to create inventory item:", err);
    }
    throw err;
  }
};

export const updateInventoryItem = async (
  itemId: string,
  payload: Partial<InventoryRequestPayload>
) => {
  try {
    const res = await patchData<
      InventoryApiItem | { item: InventoryApiItem; batches?: InventoryBatchApi[] }
    >(
      `/v1/inventory/items/${itemId}`,
      payload
    );
    return normalizeInventoryResponse(res.data);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error(
        "Failed to update inventory item:",
        err.response?.data?.message ?? err.message
      );
    } else {
      console.error("Failed to update inventory item:", err);
    }
    throw err;
  }
};

export const createInventoryBatch = async (
  itemId: string,
  payload: InventoryBatchPayload
) => {
  try {
    const res = await postData<InventoryBatchApi>(
      `/v1/inventory/items/${itemId}/batches`,
      payload
    );
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error(
        "Failed to create inventory batch:",
        err.response?.data?.message ?? err.message
      );
    } else {
      console.error("Failed to create inventory batch:", err);
    }
    throw err;
  }
};

export const hideInventoryItem = async (itemId: string) => {
  try {
    const res = await postData<
      InventoryApiItem | { item: InventoryApiItem; batches?: InventoryBatchApi[] }
    >(
      `/v1/inventory/items/${itemId}/hide`
    );
    return normalizeInventoryResponse(res.data);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error(
        "Failed to hide inventory item:",
        err.response?.data?.message ?? err.message
      );
    } else {
      console.error("Failed to hide inventory item:", err);
    }
    throw err;
  }
};

export const unhideInventoryItem = async (itemId: string) => {
  try {
    const res = await postData<
      InventoryApiItem | { item: InventoryApiItem; batches?: InventoryBatchApi[] }
    >(
      `/v1/inventory/items/${itemId}/active`
    );
    return normalizeInventoryResponse(res.data);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error(
        "Failed to unhide inventory item:",
        err.response?.data?.message ?? err.message
      );
    } else {
      console.error("Failed to unhide inventory item:", err);
    }
    throw err;
  }
};

export const fetchInventoryTurnover = async (
  organisationId: string
): Promise<InventoryTurnoverItem[]> => {
  try {
    const res = await getData<{
      items: InventoryTurnoverItem[];
    }>(`/v1/inventory/organisation/${organisationId}/turnover`);
    if (res.data?.items && Array.isArray(res.data.items)) {
      return res.data.items.map((item) => ({
        ...item,
        averageInventory:
          item.averageInventory ?? (item as any).avgInventory ?? 0,
        totalPurchases:
          item.totalPurchases ?? (item as any).totalPurchased ?? 0,
      }));
    }
    return [];
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error(
        "Failed to load inventory turnover:",
        err.response?.data?.message ?? err.message
      );
    } else {
      console.error("Failed to load inventory turnover:", err);
    }
    return [];
  }
};
