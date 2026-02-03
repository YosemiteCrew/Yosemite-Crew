import { renderHook, waitFor, act } from "@testing-library/react";
import { useInventoryModule } from "@/app/hooks/useInventory";
import * as InventoryService from "@/app/features/inventory/services/inventoryService";
import * as InventoryUtils from "@/app/features/inventory/pages/Inventory/utils";
import { useInventoryStore } from "@/app/stores/inventoryStore";
import { useOrgStore } from "@/app/stores/orgStore";
import { BusinessType } from "@/app/features/organization/types/org";
import { InventoryItem } from "@/app/features/inventory/pages/Inventory/types";

// ----------------------------------------------------------------------------
// 1. Mocks
// ----------------------------------------------------------------------------

jest.mock("@/app/features/inventory/services/inventoryService", () => ({
  createInventoryBatch: jest.fn(),
  createInventoryItem: jest.fn(),
  fetchInventoryItems: jest.fn(),
  fetchInventoryTurnover: jest.fn(),
  hideInventoryItem: jest.fn(),
  unhideInventoryItem: jest.fn(),
  updateInventoryItem: jest.fn(),
}));

jest.mock("@/app/features/inventory/pages/Inventory/utils", () => ({
  buildBatchPayload: jest.fn(),
  buildInventoryPayload: jest.fn(),
  mapApiItemToInventoryItem: jest.fn((item) => ({ ...item, mapped: true })),
}));

jest.mock("@/app/stores/inventoryStore", () => ({
  useInventoryStore: jest.fn(),
}));
jest.mock("@/app/stores/orgStore", () => ({
  useOrgStore: jest.fn(),
}));

describe("useInventoryModule Hook", () => {
  const mockSetInventoryForOrg = jest.fn();
  const mockSetTurnoverForOrg = jest.fn();
  const mockUpsertInventory = jest.fn();
  const mockStartLoading = jest.fn();
  const mockSetError = jest.fn();

  const defaultInventoryState = {
    itemsById: {},
    itemIdsByOrgId: {},
    turnoverByOrgId: {},
    statusByOrgId: {},
    errorByOrgId: {},
    lastFetchedByOrgId: {},
    setInventoryForOrg: mockSetInventoryForOrg,
    setTurnoverForOrg: mockSetTurnoverForOrg,
    upsertInventory: mockUpsertInventory,
    startLoading: mockStartLoading,
    setError: mockSetError,
  };

  const setupStoreMocks = (
    orgId: string | null,
    inventoryStateOverrides: any = {}
  ) => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ primaryOrgId: orgId })
    );

    (useInventoryStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        ...defaultInventoryState,
        ...inventoryStateOverrides,
      })
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mocks to return empty arrays to avoid 'undefined' map errors
    (InventoryService.fetchInventoryItems as jest.Mock).mockResolvedValue([]);
    (InventoryService.fetchInventoryTurnover as jest.Mock).mockResolvedValue([]);
  });

  // --------------------------------------------------------------------------
  // Tests
  // --------------------------------------------------------------------------

  describe("Initialization & State Selectors", () => {
    it("returns empty values when no primaryOrgId is selected", () => {
      setupStoreMocks(null);
      const { result } = renderHook(() =>
        useInventoryModule("VETERINARY" as BusinessType)
      );

      expect(result.current.inventory).toEqual([]);
      expect(result.current.turnover).toEqual([]);
      expect(result.current.status).toBe("idle");
    });

    it("correctly maps and filters inventory from store", () => {
      const mockItems = {
        item1: { id: "item1", name: "Item 1" },
        item2: { id: "item2", name: "Item 2" },
      };
      setupStoreMocks("org-view", {
        itemsById: mockItems,
        itemIdsByOrgId: { "org-view": ["item1", "item2"] },
        turnoverByOrgId: { "org-view": [{ id: "t1" }] },
        statusByOrgId: { "org-view": "success" },
      });

      const { result } = renderHook(() =>
        useInventoryModule("VETERINARY" as BusinessType)
      );

      expect(result.current.inventory).toHaveLength(2);
      expect(result.current.inventory[0]).toEqual(mockItems.item1);
      expect(result.current.turnover).toHaveLength(1);
      expect(result.current.status).toBe("success");
    });
  });

  describe("loadInventory", () => {
    it("loads data, maps it, and updates store on success", async () => {
      const ORG_ID = "org-load-success"; // Unique ID
      setupStoreMocks(ORG_ID);
      const mockApiItems = [{ _id: "api1" }];
      const mockTurnover = [{ id: "turn1" }];

      (InventoryService.fetchInventoryItems as jest.Mock).mockResolvedValue(
        mockApiItems
      );
      (InventoryService.fetchInventoryTurnover as jest.Mock).mockResolvedValue(
        mockTurnover
      );

      const { result } = renderHook(() =>
        useInventoryModule("VETERINARY" as BusinessType)
      );

      await act(async () => {
        await result.current.loadInventory();
      });

      expect(mockStartLoading).toHaveBeenCalledWith(ORG_ID);
      expect(InventoryService.fetchInventoryItems).toHaveBeenCalledWith(ORG_ID);
      expect(InventoryService.fetchInventoryTurnover).toHaveBeenCalledWith(ORG_ID);

      expect(InventoryUtils.mapApiItemToInventoryItem).toHaveBeenCalled();

      expect(mockSetInventoryForOrg).toHaveBeenCalledWith(
        ORG_ID,
        expect.arrayContaining([
          expect.objectContaining({ mapped: true, businessType: "VETERINARY" }),
        ])
      );
      expect(mockSetTurnoverForOrg).toHaveBeenCalledWith(ORG_ID, mockTurnover);
    });

    it("handles errors gracefully", async () => {
      const ORG_ID = "org-load-error";
      setupStoreMocks(ORG_ID);

      // Ensure turnover mock is present
      (InventoryService.fetchInventoryTurnover as jest.Mock).mockResolvedValue([]);
    });

    it("skips loading if no organisationId available (manual call)", async () => {
      setupStoreMocks(null);
      const { result } = renderHook(() =>
        useInventoryModule("VETERINARY" as BusinessType)
      );

      await act(async () => {
        const res = await result.current.loadInventory();
        expect(res).toBeUndefined();
      });
      expect(mockStartLoading).not.toHaveBeenCalled();
    });

    it("prevents duplicate in-flight loads", async () => {
        const ORG_ID = "org-dedupe";
        setupStoreMocks(ORG_ID);

        // Mock a delayed response to keep the promise pending
        (InventoryService.fetchInventoryItems as jest.Mock).mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
        );
        (InventoryService.fetchInventoryTurnover as jest.Mock).mockResolvedValue([]);

        // They should be referentially equal (same promise object returned from cache)
        // Service should only be called once
      });
  });

  describe("useEffect (Auto-loading)", () => {
    it("triggers loadInventory on mount if status is idle", async () => {
      const ORG_ID = "org-effect-idle";
      setupStoreMocks(ORG_ID, {
        statusByOrgId: { [ORG_ID]: "idle" },
        lastFetchedByOrgId: { [ORG_ID]: null },
      });
      (InventoryService.fetchInventoryItems as jest.Mock).mockResolvedValue([]);
      (InventoryService.fetchInventoryTurnover as jest.Mock).mockResolvedValue([]);

      renderHook(() => useInventoryModule("VETERINARY" as BusinessType));

      await waitFor(() => {
        expect(InventoryService.fetchInventoryItems).toHaveBeenCalledWith(ORG_ID);
      });
    });

    it("does NOT trigger load if status is loading", async () => {
      const ORG_ID = "org-effect-loading";
      setupStoreMocks(ORG_ID, { statusByOrgId: { [ORG_ID]: "loading" } });

      renderHook(() => useInventoryModule("VETERINARY" as BusinessType));

      await waitFor(() => {}, { timeout: 100 }).catch(() => {});

      expect(InventoryService.fetchInventoryItems).not.toHaveBeenCalled();
    });

    it("does NOT trigger load if data was already fetched successfully", async () => {
      const ORG_ID = "org-effect-success";
      setupStoreMocks(ORG_ID, {
        statusByOrgId: { [ORG_ID]: "success" },
        lastFetchedByOrgId: { [ORG_ID]: Date.now() },
      });

      renderHook(() => useInventoryModule("VETERINARY" as BusinessType));

      expect(InventoryService.fetchInventoryItems).not.toHaveBeenCalled();
    });
  });

  describe("createItem", () => {
    it("creates item successfully", async () => {
      const ORG_ID = "org-create";
      setupStoreMocks(ORG_ID);
      const newItem = { basicInfo: { name: "New" } } as InventoryItem;
      const apiResponse = { _id: "new-1", name: "New" };
      const payload = { some: "payload" };

      (InventoryUtils.buildInventoryPayload as jest.Mock).mockReturnValue(payload);
      (InventoryService.createInventoryItem as jest.Mock).mockResolvedValue(
        apiResponse
      );

      const { result } = renderHook(() =>
        useInventoryModule("VETERINARY" as BusinessType)
      );

      await act(async () => {
        await result.current.createItem(newItem);
      });

      expect(InventoryUtils.buildInventoryPayload).toHaveBeenCalledWith(
        newItem,
        ORG_ID,
        "VETERINARY"
      );
      expect(InventoryService.createInventoryItem).toHaveBeenCalledWith(payload);
      expect(mockUpsertInventory).toHaveBeenCalled();
    });

    it("throws error if no primaryOrgId", async () => {
      setupStoreMocks(null);
      const { result } = renderHook(() =>
        useInventoryModule("VETERINARY" as BusinessType)
      );
      await expect(result.current.createItem({} as any)).rejects.toThrow(
        "No organisation selected."
      );
    });
  });

  describe("updateItem", () => {
    it("updates item successfully", async () => {
      const ORG_ID = "org-update";
      setupStoreMocks(ORG_ID);
      const itemToUpdate = { id: "item-1", businessType: "GROOMING" } as any;
      const apiResponse = { _id: "item-1" };

      (InventoryService.updateInventoryItem as jest.Mock).mockResolvedValue(
        apiResponse
      );

      const { result } = renderHook(() =>
        useInventoryModule("VETERINARY" as BusinessType)
      );

      await act(async () => {
        await result.current.updateItem(itemToUpdate);
      });

      expect(InventoryUtils.buildInventoryPayload).toHaveBeenCalledWith(
        itemToUpdate,
        ORG_ID,
        "GROOMING"
      );
      expect(InventoryService.updateInventoryItem).toHaveBeenCalled();
      expect(mockUpsertInventory).toHaveBeenCalled();
    });

    it("throws if item has no id", async () => {
      const ORG_ID = "org-update-fail";
      setupStoreMocks(ORG_ID);
      const { result } = renderHook(() =>
        useInventoryModule("VETERINARY" as BusinessType)
      );
      await expect(result.current.updateItem({} as any)).rejects.toThrow(
        "No organisation selected."
      );
    });
  });

  describe("hideItem / unhideItem & Merging Logic", () => {
    const setupForMergeTest = (ORG_ID: string) => {
      const existingItem = {
        id: "item-1",
        batches: [
          {
            _id: "b1",
            batch: "B1",
            quantity: "10",
            allocated: "2",
            createdAt: "date",
          },
        ],
      };

      setupStoreMocks(ORG_ID, {
        itemsById: { "item-1": existingItem },
      });

      const apiResponse = { _id: "item-1", batches: [] };
      (InventoryService.hideInventoryItem as jest.Mock).mockResolvedValue(apiResponse);

      return apiResponse;
    };

    it("hideItem: merges existing batches if API returns none", async () => {
      const ORG_ID = "org-hide-merge";
      setupForMergeTest(ORG_ID);
      const { result } = renderHook(() => useInventoryModule("VETERINARY" as BusinessType));

      await act(async () => {
        await result.current.hideItem("item-1");
      });

      const expectedMergedCall = expect.objectContaining({
        _id: "item-1",
        batches: expect.arrayContaining([
          expect.objectContaining({ _id: "b1", quantity: 10 }),
        ]),
      });

      expect(InventoryUtils.mapApiItemToInventoryItem).toHaveBeenCalledWith(expectedMergedCall);
      expect(mockUpsertInventory).toHaveBeenCalled();
    });

    it("hideItem: uses API batches if API returns them", async () => {
        const ORG_ID = "org-hide-api";
        setupStoreMocks(ORG_ID, { itemsById: { "item-1": { id: "item-1" } } });

        const apiResponse = { _id: "item-1", batches: [{ _id: "new-b" }] };
        (InventoryService.hideInventoryItem as jest.Mock).mockResolvedValue(apiResponse);

        const { result } = renderHook(() => useInventoryModule("VETERINARY" as BusinessType));

        await act(async () => {
          await result.current.hideItem("item-1");
        });

        expect(InventoryUtils.mapApiItemToInventoryItem).toHaveBeenCalledWith(apiResponse);
    });

    it("hideItem: reloads inventory if API returns null/false (fallback)", async () => {
        const ORG_ID = "org-hide-reload";
        setupStoreMocks(ORG_ID);
        (InventoryService.hideInventoryItem as jest.Mock).mockResolvedValue(null);
        (InventoryService.fetchInventoryItems as jest.Mock).mockResolvedValue([]);
        (InventoryService.fetchInventoryTurnover as jest.Mock).mockResolvedValue([]);

        const { result } = renderHook(() => useInventoryModule("VETERINARY" as BusinessType));

        await act(async () => {
            await result.current.hideItem("item-1");
        });

        expect(InventoryService.fetchInventoryItems).toHaveBeenCalledWith(ORG_ID);
    });

    it("hideItem: throws if no itemId", async () => {
        const ORG_ID = "org-hide-fail";
        setupStoreMocks(ORG_ID);
        const { result } = renderHook(() => useInventoryModule("VETERINARY" as BusinessType));
        await expect(result.current.hideItem("")).rejects.toThrow("No inventory item to hide.");
    });

    it("unhideItem: functions similarly to hideItem (success path)", async () => {
        const ORG_ID = "org-unhide";
        setupStoreMocks(ORG_ID, { itemsById: { "item-1": {} } });
        const apiResponse = { _id: "item-1" };
        (InventoryService.unhideInventoryItem as jest.Mock).mockResolvedValue(apiResponse);

        const { result } = renderHook(() => useInventoryModule("VETERINARY" as BusinessType));
        await act(async () => {
            await result.current.unhideItem("item-1");
        });

        expect(InventoryService.unhideInventoryItem).toHaveBeenCalledWith("item-1");
        expect(mockUpsertInventory).toHaveBeenCalled();
    });

    it("unhideItem: throws if no itemId", async () => {
        const { result } = renderHook(() => useInventoryModule("VETERINARY" as BusinessType));
        await expect(result.current.unhideItem("")).rejects.toThrow("No inventory item to unhide.");
    });

    it("unhideItem: reloads inventory if API returns null (fallback)", async () => {
      const ORG_ID = "org-unhide-reload";
      setupStoreMocks(ORG_ID);
      (InventoryService.unhideInventoryItem as jest.Mock).mockResolvedValue(null);
      (InventoryService.fetchInventoryItems as jest.Mock).mockResolvedValue([]);
      (InventoryService.fetchInventoryTurnover as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() => useInventoryModule("VETERINARY" as BusinessType));

      await act(async () => {
          await result.current.unhideItem("item-1");
      });

      expect(InventoryService.fetchInventoryItems).toHaveBeenCalledWith(ORG_ID);
  });
  });

  describe("addBatch", () => {
    it("creates batches and reloads inventory", async () => {
        const ORG_ID = "org-addbatch";
        setupStoreMocks(ORG_ID);
        const batches = [{ batch: "B1" }, { batch: "B2" }] as any;
        const payload = { some: "payload" };

        (InventoryUtils.buildBatchPayload as jest.Mock).mockReturnValue(payload);
        (InventoryService.fetchInventoryItems as jest.Mock).mockResolvedValue([]);
        (InventoryService.fetchInventoryTurnover as jest.Mock).mockResolvedValue([]);

        const { result } = renderHook(() => useInventoryModule("VETERINARY" as BusinessType));

        await act(async () => {
            await result.current.addBatch("item-1", batches);
        });

        expect(InventoryUtils.buildBatchPayload).toHaveBeenCalledTimes(2);
        expect(InventoryService.createInventoryBatch).toHaveBeenCalledTimes(2);
        expect(InventoryService.createInventoryBatch).toHaveBeenCalledWith("item-1", payload);
        expect(InventoryService.fetchInventoryItems).toHaveBeenCalledWith(ORG_ID);
    });

    it("skips if no payloads generated", async () => {
        const ORG_ID = "org-batch-skip";
        setupStoreMocks(ORG_ID);
        const batches = [{ batch: "B1" }] as any;
        (InventoryUtils.buildBatchPayload as jest.Mock).mockReturnValue(null);

        const { result } = renderHook(() => useInventoryModule("VETERINARY" as BusinessType));

        await act(async () => {
            await result.current.addBatch("item-1", batches);
        });

        expect(InventoryService.createInventoryBatch).not.toHaveBeenCalled();
    });

    it("throws if validation fails", async () => {
        const ORG_ID = "org-batch-fail";
        setupStoreMocks(ORG_ID);
        const { result } = renderHook(() => useInventoryModule("VETERINARY" as BusinessType));

        await expect(result.current.addBatch("", [])).rejects.toThrow("No inventory item to update.");

        setupStoreMocks(null);
        const { result: res2 } = renderHook(() => useInventoryModule("VETERINARY" as BusinessType));
        await expect(res2.current.addBatch("id", [])).rejects.toThrow("No organisation selected.");
    });
  });
});