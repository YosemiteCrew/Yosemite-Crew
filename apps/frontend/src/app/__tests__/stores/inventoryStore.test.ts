import { useInventoryStore } from "../../stores/inventoryStore";
import { InventoryItem, InventoryTurnoverItem } from "../../pages/Inventory/types";

// --- Mock Data ---
// We cast to unknown first to avoid strict type adherence for massive objects in tests
const mockItem1: InventoryItem = {
  id: "item-1",
  organisationId: "org-A",
  basicInfo: { name: "Bandages" },
} as unknown as InventoryItem;

const mockItem2: InventoryItem = {
  id: "item-2",
  organisationId: "org-A",
  basicInfo: { name: "Syringes" },
} as unknown as InventoryItem;

const mockItem3: InventoryItem = {
  id: "item-3",
  organisationId: "org-B",
  basicInfo: { name: "Vaccines" },
} as unknown as InventoryItem;

// Item without ID but with name (fallback logic)
const mockItemFallback: InventoryItem = {
  organisationId: "org-A",
  basicInfo: { name: "GenericPills" },
} as unknown as InventoryItem;

// Item completely invalid (no ID, no name)
const mockItemInvalid: InventoryItem = {
  organisationId: "org-A",
  basicInfo: {},
} as unknown as InventoryItem;

const mockTurnover1: InventoryTurnoverItem = {
  id: "turn-1",
  itemId: "item-1",
  quantity: 10,
} as unknown as InventoryTurnoverItem;

describe("Inventory Store", () => {
  // Reset store before each test
  beforeEach(() => {
    useInventoryStore.setState({
      itemsById: {},
      itemIdsByOrgId: {},
      turnoverByOrgId: {},
      statusByOrgId: {},
      errorByOrgId: {},
      lastFetchedByOrgId: {},
    });
    jest.clearAllMocks();
  });

  // --- Section 1: Initialization & Status Management ---
  describe("Initialization & Status", () => {
    it("initializes with default empty state", () => {
      const state = useInventoryStore.getState();
      expect(state.itemsById).toEqual({});
      expect(state.itemIdsByOrgId).toEqual({});
      expect(state.turnoverByOrgId).toEqual({});
    });

    it("manages loading state for specific org", () => {
      const store = useInventoryStore.getState();

      store.startLoading("org-A");

      const state = useInventoryStore.getState();
      expect(state.statusByOrgId["org-A"]).toBe("loading");
      expect(state.errorByOrgId["org-A"]).toBeNull();
    });

    it("marks org as loaded explicitly", () => {
      const store = useInventoryStore.getState();
      store.startLoading("org-A");

      store.markLoaded("org-A");

      const state = useInventoryStore.getState();
      expect(state.statusByOrgId["org-A"]).toBe("loaded");
      expect(state.lastFetchedByOrgId["org-A"]).toBeDefined();
    });

    it("sets error state for specific org", () => {
      const store = useInventoryStore.getState();
      store.setError("org-A", "Fetch failed");

      const state = useInventoryStore.getState();
      expect(state.statusByOrgId["org-A"]).toBe("error");
      expect(state.errorByOrgId["org-A"]).toBe("Fetch failed");
    });
  });

  // --- Section 2: Inventory CRUD Operations ---
  describe("Inventory Operations", () => {
    it("sets inventory for an org (bulk set)", () => {
      const store = useInventoryStore.getState();

      // Initial junk data to ensure it gets cleared for that org
      store.upsertInventory(mockItem1);

      // Set new list (replaces previous list for this org)
      store.setInventoryForOrg("org-A", [mockItem2, mockItemFallback]);

      const state = useInventoryStore.getState();

      // item-1 should be gone (from org-A list logic) - Note: setInventoryForOrg implementation
      // deletes items by ID first found in existingIds.
      expect(state.itemsById["item-1"]).toBeUndefined();

      // item-2 should exist
      expect(state.itemsById["item-2"]).toBeDefined();

      // Fallback item should use name as ID
      expect(state.itemsById["GenericPills"]).toBeDefined();
      expect(state.itemIdsByOrgId["org-A"]).toContain("GenericPills");
    });

    it("ignores invalid items during bulk set", () => {
      const store = useInventoryStore.getState();
      store.setInventoryForOrg("org-A", [mockItemInvalid]);

      const state = useInventoryStore.getState();
      expect(state.itemIdsByOrgId["org-A"]).toHaveLength(0);
    });

    it("upserts (adds) a new item", () => {
      const store = useInventoryStore.getState();
      store.upsertInventory(mockItem1);

      const state = useInventoryStore.getState();
      expect(state.itemsById["item-1"]).toEqual(mockItem1);
      expect(state.itemIdsByOrgId["org-A"]).toEqual(["item-1"]);
    });

    it("upserts (updates) an existing item", () => {
      const store = useInventoryStore.getState();
      store.upsertInventory(mockItem1);

      // Create an update that mimics adding a 'quantity' field
      const updatedItem = { ...mockItem1, quantity: 99 } as unknown as InventoryItem;
      store.upsertInventory(updatedItem);

      const state = useInventoryStore.getState();
      // FIX: Cast to 'any' to verify the property merge without TS complaining
      expect((state.itemsById["item-1"] as any).quantity).toBe(99);
      // Should not duplicate ID
      expect(state.itemIdsByOrgId["org-A"]).toHaveLength(1);
    });

    it("handles upsert with missing ID/OrgID gracefully", () => {
      const store = useInventoryStore.getState();

      // No ID or Name
      store.upsertInventory(mockItemInvalid);

      // No Org ID
      const noOrgItem = { id: "item-x", basicInfo: { name: "X" } } as InventoryItem;
      store.upsertInventory(noOrgItem);

      const state = useInventoryStore.getState();
      expect(Object.keys(state.itemsById)).toHaveLength(0);
    });

    it("removes an item by ID and OrgID", () => {
      const store = useInventoryStore.getState();
      store.setInventoryForOrg("org-A", [mockItem1, mockItem2]);

      store.removeInventory("item-1", "org-A");

      const state = useInventoryStore.getState();
      expect(state.itemsById["item-1"]).toBeUndefined();
      expect(state.itemsById["item-2"]).toBeDefined();
      expect(state.itemIdsByOrgId["org-A"]).toEqual(["item-2"]);
    });

    it("removes an item without providing OrgID (clears from global map only)", () => {
      const store = useInventoryStore.getState();
      store.setInventoryForOrg("org-A", [mockItem1]);

      // Remove without orgId -> implementation only deletes from itemsById,
      // but doesn't filter the org list (based on the source provided)
      store.removeInventory("item-1");

      const state = useInventoryStore.getState();
      expect(state.itemsById["item-1"]).toBeUndefined();
      // Note: In your source, if orgId is missing, it skips the filtering logic for itemIdsByOrgId
    });

    it("does nothing if removing non-existent item", () => {
      const store = useInventoryStore.getState();
      store.removeInventory("fake-id");

      // Just ensure no crash
      const state = useInventoryStore.getState();
      expect(state.itemsById).toEqual({});
    });
  });

  // --- Section 3: Turnover Operations ---
  describe("Turnover Operations", () => {
    it("sets turnover items for an org", () => {
      const store = useInventoryStore.getState();
      store.setTurnoverForOrg("org-A", [mockTurnover1]);

      const state = useInventoryStore.getState();
      expect(state.turnoverByOrgId["org-A"]).toHaveLength(1);
      expect(state.turnoverByOrgId["org-A"][0]).toEqual(mockTurnover1);
      expect(state.statusByOrgId["org-A"]).toBe("loaded");
    });

    it("retrieves turnover by org ID", () => {
      const store = useInventoryStore.getState();
      store.setTurnoverForOrg("org-A", [mockTurnover1]);

      const result = store.getTurnoverByOrgId("org-A");
      expect(result).toEqual([mockTurnover1]);

      // Empty case
      expect(store.getTurnoverByOrgId("org-B")).toEqual([]);
    });
  });

  // --- Section 4: Clearing & Getters ---
  describe("Clear & Getters", () => {
    it("retrieves inventory by org ID", () => {
      const store = useInventoryStore.getState();
      store.setInventoryForOrg("org-A", [mockItem1, mockItem2]);
      store.setInventoryForOrg("org-B", [mockItem3]);

      const orgAItems = store.getInventoryByOrgId("org-A");
      expect(orgAItems).toHaveLength(2);
      expect(orgAItems.find(i => i.id === "item-1")).toBeDefined();

      // Ensure filtered correctly (no nulls if ID exists in list but not in map)
      // This covers the .filter(Boolean) line
      // Manually corrupt state: ID in list, but item removed from map
      useInventoryStore.setState({
        itemIdsByOrgId: { "org-A": ["item-1", "ghost-id"] }
      });

      const filteredItems = store.getInventoryByOrgId("org-A");
      expect(filteredItems).toHaveLength(1); // ghost-id should be filtered out
    });

    it("clears data for a specific org", () => {
      const store = useInventoryStore.getState();
      store.setInventoryForOrg("org-A", [mockItem1]);
      store.setTurnoverForOrg("org-A", [mockTurnover1]);
      store.setInventoryForOrg("org-B", [mockItem3]);

      store.clearOrg("org-A");

      const state = useInventoryStore.getState();
      // Org A data gone
      expect(state.itemIdsByOrgId["org-A"]).toBeUndefined();
      expect(state.turnoverByOrgId["org-A"]).toBeUndefined();
      expect(state.statusByOrgId["org-A"]).toBeUndefined();

      // Org B data remains
      expect(state.itemIdsByOrgId["org-B"]).toBeDefined();
    });

    it("clears entire store", () => {
      const store = useInventoryStore.getState();
      store.setInventoryForOrg("org-A", [mockItem1]);

      store.clearAll();

      const state = useInventoryStore.getState();
      expect(state.itemsById).toEqual({});
      expect(state.itemIdsByOrgId).toEqual({});
      expect(state.turnoverByOrgId).toEqual({});
      expect(state.lastFetchedByOrgId).toEqual({});
    });
  });
});