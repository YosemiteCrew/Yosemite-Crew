import axios from "axios";
import {
  getData,
  patchData,
  postData,
} from "@/app/services/axios";
import {
  InventoryApiItem,
  InventoryRequestPayload,
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
    const res = await postData<InventoryApiItem>("/v1/inventory/items", payload);
    return res.data;
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
    const res = await patchData<InventoryApiItem>(
      `/v1/inventory/items/${itemId}`,
      payload
    );
    return res.data;
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

export const hideInventoryItem = async (itemId: string) => {
  try {
    const res = await postData<InventoryApiItem>(
      `/v1/inventory/items/${itemId}/hide`
    );
    return res.data;
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
    const res = await postData<InventoryApiItem>(
      `/v1/inventory/items/${itemId}/unhide`
    );
    return res.data;
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
