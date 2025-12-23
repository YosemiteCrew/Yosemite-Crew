import {
  toStringSafe,
  toNumberSafe,
  formatDisplayDate,
  calculateBatchTotals,
  formatStatusLabel,
  formatStockHealthLabel,
  getStatusBadgeStyle,
  mapApiItemToInventoryItem,
  buildBatchPayload,
  buildInventoryPayload,
  displayStatusLabel,
  defaultFilters,
} from "@/app/pages/Inventory/utils";
import {
  InventoryApiItem,
  InventoryItem,
  BatchValues,
} from "@/app/pages/Inventory/types";
import { BusinessType } from "@/app/types/org";

describe("Inventory Utils", () => {
  // --- Section 1: Primitive Helpers ---

  describe("toStringSafe", () => {
    it("returns string representation of values", () => {
      expect(toStringSafe("test")).toBe("test");
      expect(toStringSafe(123)).toBe("123");
      expect(toStringSafe(0)).toBe("0");
    });

    it("returns empty string for undefined/null/NaN", () => {
      expect(toStringSafe(undefined)).toBe("");
      expect(toStringSafe(null)).toBe("");
      expect(toStringSafe(Number.NaN)).toBe("");
    });
  });

  describe("toNumberSafe", () => {
    it("returns number for valid inputs", () => {
      expect(toNumberSafe(100)).toBe(100);
      expect(toNumberSafe("50")).toBe(50);
      expect(toNumberSafe("10.5")).toBe(10.5);
    });

    it("returns undefined for invalid inputs", () => {
      expect(toNumberSafe(undefined)).toBeUndefined();
      expect(toNumberSafe("abc")).toBeUndefined();
      expect(toNumberSafe({})).toBeUndefined();
    });

    it("returns 0 for null (Javascript Number(null) behavior)", () => {
      expect(toNumberSafe(null)).toBe(0);
    });
  });

  // --- Section 2: Date & Status Formatting ---

  describe("formatDisplayDate", () => {
    it("formats ISO date strings correctly", () => {
      const res = formatDisplayDate("2023-01-01");
      expect(res).toContain("Jan");
      expect(res).toContain("2023");
    });

    it("formats DD/MM/YYYY strings correctly", () => {
      const res = formatDisplayDate("31/12/2022");
      expect(res).toContain("31");
      expect(res).toContain("Dec");
      expect(res).toContain("2022");
    });

    it("returns empty string for invalid dates or empty input", () => {
      expect(formatDisplayDate("")).toBe("");
      expect(formatDisplayDate("invalid-date")).toBe("");
    });
  });

  describe("Status Labels", () => {
    it("formats status labels correctly", () => {
      expect(formatStatusLabel("ACTIVE")).toBe("Active");
      expect(formatStatusLabel("HIDDEN")).toBe("Hidden");
      expect(formatStatusLabel("UNKNOWN")).toBe("UNKNOWN");
      expect(formatStatusLabel("")).toBe("Active");
    });

    it("formats stock health labels correctly", () => {
      expect(formatStockHealthLabel("LOW_STOCK")).toBe("Low stock");
      expect(formatStockHealthLabel("HEALTHY")).toBe("Healthy");
      expect(formatStockHealthLabel("EXPIRED")).toBe("Expired");
      expect(formatStockHealthLabel("EXPIRING_SOON")).toBe("Expiring soon");
      expect(formatStockHealthLabel()).toBe("");
    });

    it("resolves display status label (priority logic)", () => {
      const hiddenItem = { status: "HIDDEN", basicInfo: {} } as any;
      expect(displayStatusLabel(hiddenItem)).toBe("Hidden");

      const healthItem = { status: "ACTIVE", stockHealth: "LOW_STOCK", basicInfo: {} } as any;
      expect(displayStatusLabel(healthItem)).toBe("Low stock");

      const activeItem = { status: "ACTIVE", basicInfo: {} } as any;
      expect(displayStatusLabel(activeItem)).toBe("Active");
    });
  });

  describe("getStatusBadgeStyle", () => {
    it("returns correct colors for statuses", () => {
      expect(getStatusBadgeStyle("low stock")).toEqual({ color: "#F68523", backgroundColor: "#FEF3E9" });
      expect(getStatusBadgeStyle("expired")).toEqual({ color: "#EA3729", backgroundColor: "#FDEBEA" });
      expect(getStatusBadgeStyle("out of stock")).toEqual({ color: "#EA3729", backgroundColor: "#FDEBEA" });
      expect(getStatusBadgeStyle("hidden")).toEqual({ color: "#302f2e", backgroundColor: "#eaeaea" });
      expect(getStatusBadgeStyle("expiring soon")).toEqual({ color: "#C47F00", backgroundColor: "#FEF7E5" });
      expect(getStatusBadgeStyle("healthy")).toEqual({ color: "#247AED", backgroundColor: "#EAF3FF" });
      expect(getStatusBadgeStyle("active")).toEqual({ color: "#54B492", backgroundColor: "#E6F4EF" });
      expect(getStatusBadgeStyle("unknown")).toEqual({ color: "#247AED", backgroundColor: "#EAF3FF" });
    });
  });

  // --- Section 3: Calculations ---

  describe("calculateBatchTotals", () => {
    it("returns empty object for empty/undefined batches", () => {
      expect(calculateBatchTotals()).toEqual({});
      expect(calculateBatchTotals([])).toEqual({});
    });

    it("calculates totals correctly", () => {
      const batches = [
        { quantity: "100", allocated: "20" },
        { quantity: 50, allocated: 0 },
        { quantity: "invalid", allocated: undefined },
      ] as any;

      const result = calculateBatchTotals(batches);
      expect(result.onHand).toBe(150);
      expect(result.allocated).toBe(20);
      expect(result.available).toBe(130);
    });

    it("handles allocated only scenario", () => {
      const batches = [{ allocated: 10 }] as any;
      const result = calculateBatchTotals(batches);
      expect(result.onHand).toBeUndefined();
      expect(result.allocated).toBe(10);
      expect(result.available).toBe(-10);
    });
  });

  // --- Section 4: Mappers (API -> Frontend) ---

  describe("mapApiItemToInventoryItem", () => {
    // FIX: Using "vet" as valid BusinessType and adding mandatory name/orgId
    const mockApiItem: InventoryApiItem = {
      _id: "item-1",
      organisationId: "org-1",
      businessType: "vet" as BusinessType,
      name: "Test Item",
      sku: "SKU-123",
      status: "ACTIVE",
      onHand: 100,
      allocated: 10,
      attributes: {
        department: "Medical",
        species: ["Dog", "Cat"],
        brand: "Pfizer",
        current: 90,
      },
      batches: [
        {
          _id: "b1",
          batchNumber: "BATCH-001",
          expiryDate: "2025-12-31",
          quantity: 50,
          allocated: 5,
        },
        {
          _id: "b2",
          batchNumber: "BATCH-002",
          expiryDate: "2024-01-01",
          quantity: 50,
          allocated: 5,
        },
      ],
    };

    it("maps basic fields correctly", () => {
      const result = mapApiItemToInventoryItem(mockApiItem);
      expect(result.id).toBe("item-1");
      expect(result.basicInfo.name).toBe("Test Item");
      expect(result.basicInfo.status).toBe("Active");
      expect(result.vendor.brand).toBe("Pfizer");
    });

    it("maps array attributes correctly (species)", () => {
      const result = mapApiItemToInventoryItem(mockApiItem);
      expect(result.classification.species).toEqual(["Dog", "Cat"]);
    });

    it("selects the primary batch based on earliest expiry", () => {
      const result = mapApiItemToInventoryItem(mockApiItem);
      expect(result.batch.batch).toBe("BATCH-002");
    });

    it("calculates totals from batches preferentially", () => {
      const result = mapApiItemToInventoryItem(mockApiItem);
      expect(result.stock.current).toBe("100");
      expect(result.stock.allocated).toBe("10");
      expect(result.stock.available).toBe("90");
    });

    it("falls back to attributes if batches missing", () => {
      const noBatchItem = { ...mockApiItem, batches: [] };
      const result = mapApiItemToInventoryItem(noBatchItem);
      expect(result.stock.current).toBe("100");
    });

    it("handles deeply nested attribute fallbacks", () => {
      const complexItem: InventoryApiItem = {
        _id: "2",
        organisationId: "org-1",
        businessType: "vet" as BusinessType,
        name: "Complex Item",
        sku: "SKU-999",
        attributes: {
          unitofMeasure: "tablets",
          nextRefillDate: "2025-01-01",
        },
        batches: [],
      };
      const result = mapApiItemToInventoryItem(complexItem);
      expect(result.classification.unitofMeasure).toBe("tablets");
      expect(result.batch.nextRefillDate).toBe("2025-01-01");
    });

    it("handles undefined/null in array attributes", () => {
        const item = { ...mockApiItem, attributes: { species: [null, "Dog"] } } as any;
        const result = mapApiItemToInventoryItem(item);
        expect(result.classification.species).toEqual(["Dog"]);
    });
  });

  // --- Section 5: Payload Builders (Frontend -> API) ---

  describe("buildBatchPayload", () => {
    // FIX: Added required manufactureDate
    const mockBatch: BatchValues = {
      _id: "b1",
      itemId: "i1",
      batch: "B-123",
      manufactureDate: "",
      expiryDate: "31/12/2025",
      quantity: "100",
      allocated: "10",
    };

    it("converts DD/MM/YYYY dates to ISO YYYY-MM-DD", () => {
      const payload = buildBatchPayload(mockBatch);
      expect(payload?.expiryDate).toBe("2025-12-31");
    });

    it("passes ISO dates through correctly", () => {
      const isoBatch = { ...mockBatch, manufactureDate: "2023-01-01" };
      const payload = buildBatchPayload(isoBatch);
      expect(payload?.manufactureDate).toBe("2023-01-01");
    });

    it("converts numbers correctly", () => {
      const payload = buildBatchPayload(mockBatch);
      expect(payload?.quantity).toBe(100);
      expect(payload?.allocated).toBe(10);
    });

    it("returns undefined if payload is empty (all cleaned)", () => {
      const emptyBatch = { batch: "" } as any;
      expect(buildBatchPayload(emptyBatch)).toBeUndefined();
    });
  });

  describe("buildInventoryPayload", () => {
    const mockInventoryItem: InventoryItem = {
      id: "i1",
      businessType: "vet" as BusinessType,
      basicInfo: {
        name: "Payload Item",
        category: "Meds",
        skuCode: "SKU-P",
        department: "Dept",
        description: "Desc",
      },
      classification: {
        unitofMeasure: "ml",
        species: ["Cat"],
      },
      pricing: {
        purchaseCost: "10.50",
        selling: "20.00",
        tax: "5",
      },
      vendor: {
        vendor: "v1",
        supplierName: "Sup",
      },
      stock: {
        current: "100",
        allocated: "0",
        available: "100",
      },
      batch: {
        batch: "B1",
        quantity: "100",
      },
      batches: [
        { batch: "B1", quantity: "50", manufactureDate: "" },
        { batch: "B2", quantity: "50", manufactureDate: "" },
      ],
    } as any;

    it("constructs valid payload structure", () => {
      // FIX: Changed "CLINIC" to "vet" as BusinessType
      const payload = buildInventoryPayload(mockInventoryItem, "org-1", "vet" as BusinessType);

      expect(payload.organisationId).toBe("org-1");
      expect(payload.name).toBe("Payload Item");
      expect(payload.attributes?.unitofMeasure).toBe("ml");
      expect(payload.attributes?.species).toEqual(["Cat"]);
      expect(payload.unitCost).toBe(10.5);
      expect(payload.batches).toHaveLength(2);
    });

    it("normalizes status for API", () => {
      const item = { ...mockInventoryItem, basicInfo: { ...mockInventoryItem.basicInfo, status: "Low Stock" } };
      const payload = buildInventoryPayload(item, "org-1", "vet" as BusinessType);
      expect(payload.status).toBe("LOW_STOCK");
    });

    it("calculates totals from batches payload", () => {
      const payload = buildInventoryPayload(mockInventoryItem, "org-1", "vet" as BusinessType);
      expect(payload.onHand).toBe(100);
    });

    it("falls back to batch property if batches array is empty", () => {
      const singleBatchItem = { ...mockInventoryItem, batches: undefined };
      const payload = buildInventoryPayload(singleBatchItem, "org-1", "vet" as BusinessType);

      expect(payload.batches).toHaveLength(1);
      expect(payload.batches![0].batchNumber).toBe("B1");
    });
  });

  describe("Constants", () => {
    it("exports defaultFilters", () => {
      expect(defaultFilters).toEqual({
        category: "all",
        status: "ALL",
        search: "",
      });
    });
  });
});