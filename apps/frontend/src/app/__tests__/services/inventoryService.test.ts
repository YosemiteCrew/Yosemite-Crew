import {
  fetchInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  createInventoryBatch,
  hideInventoryItem,
  unhideInventoryItem,
  fetchInventoryTurnover,
} from "../../services/inventoryService";
import { getData, postData, patchData } from "../../services/axios";
import axios from "axios";
import { InventoryRequestPayload, InventoryBatchPayload } from "../../pages/Inventory/types";

// --- Mocks ---

// 1. Mock Axios Library (Fixed Hoisting Issue)
jest.mock("axios", () => {
  return {
    create: jest.fn(() => ({
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    })),
    isAxiosError: jest.fn(),
  };
});

// 2. Mock Axios Service Helper
jest.mock("../../services/axios");
const mockedGetData = getData as jest.Mock;
const mockedPostData = postData as jest.Mock;
const mockedPatchData = patchData as jest.Mock;
const mockedIsAxiosError = axios.isAxiosError as unknown as jest.Mock;

describe("Inventory Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Fetch Inventory Items ---
  describe("fetchInventoryItems", () => {
    it("fetches items with stripped params and returns data", async () => {
      const mockItems = [{ id: "inv-1" }];
      mockedGetData.mockResolvedValue({ data: mockItems });

      const params = { search: "test", page: 1, invalid: undefined, empty: "" };
      const result = await fetchInventoryItems("org-1", params);

      expect(mockedGetData).toHaveBeenCalledWith(
        "/v1/inventory/organisation/org-1/items",
        { search: "test", page: 1 }
      );
      expect(result).toEqual(mockItems);
    });

    it("returns empty array and warns if response is not an array", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      mockedGetData.mockResolvedValue({ data: { items: [] } });

      const result = await fetchInventoryItems("org-1");

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Inventory list response is not an array",
        { items: [] }
      );
      consoleSpy.mockRestore();
    });

    it("handles Axios errors", async () => {
      const error = { response: { data: { message: "API Error" } }, message: "Fail" };
      mockedGetData.mockRejectedValue(error);
      mockedIsAxiosError.mockReturnValue(true);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(fetchInventoryItems("org-1")).rejects.toEqual(error);
      expect(consoleSpy).toHaveBeenCalledWith("Failed to load inventory items:", "API Error");
      consoleSpy.mockRestore();
    });

    it("handles non-Axios errors", async () => {
      const error = new Error("JS Error");
      mockedGetData.mockRejectedValue(error);
      mockedIsAxiosError.mockReturnValue(false);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(fetchInventoryItems("org-1")).rejects.toEqual(error);
      expect(consoleSpy).toHaveBeenCalledWith("Failed to load inventory items:", error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 2: Create Inventory Item ---
  describe("createInventoryItem", () => {
    const payload = { name: "New Item" } as unknown as InventoryRequestPayload;

    it("creates item and returns direct response", async () => {
      const mockResponse = { id: "inv-1", name: "New Item" };
      mockedPostData.mockResolvedValue({ data: mockResponse });

      const result = await createInventoryItem(payload);

      expect(mockedPostData).toHaveBeenCalledWith("/v1/inventory/items", payload);
      expect(result).toEqual(mockResponse);
    });

    it("creates item and normalizes nested response structure", async () => {
      const mockResponse = {
        item: { id: "inv-1", name: "New Item" },
        batches: [{ id: "batch-1" }],
      };
      mockedPostData.mockResolvedValue({ data: mockResponse });

      const result = await createInventoryItem(payload);

      expect(result).toEqual({
        id: "inv-1",
        name: "New Item",
        batches: [{ id: "batch-1" }],
      });
    });

    it("handles errors", async () => {
      const error = new Error("Create Error");
      mockedPostData.mockRejectedValue(error);
      mockedIsAxiosError.mockReturnValue(false);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(createInventoryItem(payload)).rejects.toThrow("Create Error");
      expect(consoleSpy).toHaveBeenCalledWith("Failed to create inventory item:", error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 3: Update Inventory Item ---
  describe("updateInventoryItem", () => {
    const payload = { name: "Updated" };

    it("updates item and returns normalized response", async () => {
      const mockResponse = { id: "inv-1", name: "Updated" };
      mockedPatchData.mockResolvedValue({ data: mockResponse });

      const result = await updateInventoryItem("inv-1", payload);

      expect(mockedPatchData).toHaveBeenCalledWith("/v1/inventory/items/inv-1", payload);
      expect(result).toEqual(mockResponse);
    });

    it("handles Axios errors", async () => {
      const error = { message: "Network Error" };
      mockedPatchData.mockRejectedValue(error);
      mockedIsAxiosError.mockReturnValue(true);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(updateInventoryItem("inv-1", payload)).rejects.toEqual(error);
      expect(consoleSpy).toHaveBeenCalledWith("Failed to update inventory item:", "Network Error");
      consoleSpy.mockRestore();
    });
  });

  // --- Section 4: Create Inventory Batch ---
  describe("createInventoryBatch", () => {
    const payload = { quantity: 10 } as unknown as InventoryBatchPayload;

    it("creates batch and returns data", async () => {
      const mockResponse = { id: "batch-1" };
      mockedPostData.mockResolvedValue({ data: mockResponse });

      const result = await createInventoryBatch("inv-1", payload);

      expect(mockedPostData).toHaveBeenCalledWith("/v1/inventory/items/inv-1/batches", payload);
      expect(result).toEqual(mockResponse);
    });

    it("handles errors", async () => {
      const error = new Error("Batch Error");
      mockedPostData.mockRejectedValue(error);
      mockedIsAxiosError.mockReturnValue(false);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(createInventoryBatch("inv-1", payload)).rejects.toThrow("Batch Error");
      expect(consoleSpy).toHaveBeenCalledWith("Failed to create inventory batch:", error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 5: Status Operations ---
  describe("Status Operations", () => {
    it("hides item successfully", async () => {
      const mockResponse = { id: "inv-1", hidden: true };
      mockedPostData.mockResolvedValue({ data: mockResponse });

      const result = await hideInventoryItem("inv-1");

      expect(mockedPostData).toHaveBeenCalledWith("/v1/inventory/items/inv-1/hide");
      expect(result).toEqual(mockResponse);
    });

    it("handles error during hide", async () => {
      const error = { response: { data: { message: "Cannot hide" } } };
      mockedPostData.mockRejectedValue(error);
      mockedIsAxiosError.mockReturnValue(true);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(hideInventoryItem("inv-1")).rejects.toEqual(error);
      expect(consoleSpy).toHaveBeenCalledWith("Failed to hide inventory item:", "Cannot hide");
      consoleSpy.mockRestore();
    });

    it("unhides item successfully", async () => {
      const mockResponse = { id: "inv-1", hidden: false };
      mockedPostData.mockResolvedValue({ data: mockResponse });

      const result = await unhideInventoryItem("inv-1");

      expect(mockedPostData).toHaveBeenCalledWith("/v1/inventory/items/inv-1/active");
      expect(result).toEqual(mockResponse);
    });

    it("handles error during unhide", async () => {
      const error = new Error("Unhide Error");
      mockedPostData.mockRejectedValue(error);
      mockedIsAxiosError.mockReturnValue(false);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(unhideInventoryItem("inv-1")).rejects.toThrow("Unhide Error");
      expect(consoleSpy).toHaveBeenCalledWith("Failed to unhide inventory item:", error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 6: Fetch Inventory Turnover ---
  describe("fetchInventoryTurnover", () => {
    it("fetches, maps fields, and returns turnover items", async () => {
      const apiResponse = {
        items: [
          {
            id: "t-1",
            averageInventory: 10,
            totalPurchases: 50,
          },
          {
            id: "t-2",
            avgInventory: 20,
            totalPurchased: 100,
          },
        ],
      };
      mockedGetData.mockResolvedValue({ data: apiResponse });

      const result = await fetchInventoryTurnover("org-1");

      expect(mockedGetData).toHaveBeenCalledWith("/v1/inventory/organisation/org-1/turnover");

      expect(result[0]).toMatchObject({ averageInventory: 10, totalPurchases: 50 });
      expect(result[1]).toMatchObject({ averageInventory: 20, totalPurchases: 100 });
    });

    it("returns empty array if response items is invalid", async () => {
      mockedGetData.mockResolvedValue({ data: { items: null } });
      const result = await fetchInventoryTurnover("org-1");
      expect(result).toEqual([]);
    });

    it("handles errors gracefully", async () => {
      const error = { message: "Failed" };
      mockedGetData.mockRejectedValue(error);
      mockedIsAxiosError.mockReturnValue(true);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const result = await fetchInventoryTurnover("org-1");

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith("Failed to load inventory turnover:", "Failed");
      consoleSpy.mockRestore();
    });
  });
});