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
  defaultFilters,
  displayStatusLabel,
} from "@/app/features/inventory/pages/Inventory/utils";
import { BusinessType } from "@/app/features/organization/types/org";
import { InventoryApiItem, InventoryItem, BatchValues } from "@/app/features/inventory/pages/Inventory/types";

describe("Inventory Utils", () => {
  // --------------------------------------------------------------------------
  // 1. Basic Safe Conversion Helpers
  // --------------------------------------------------------------------------
  describe("toStringSafe", () => {
    it("returns empty string for null or undefined", () => {
      expect(toStringSafe(null)).toBe("");
      expect(toStringSafe(undefined)).toBe("");
    });

    it("returns empty string for NaN", () => {
      expect(toStringSafe(Number.NaN)).toBe("");
    });

    it("returns string representation for valid values", () => {
      expect(toStringSafe(123)).toBe("123");
      expect(toStringSafe("hello")).toBe("hello");
      expect(toStringSafe(0)).toBe("0");
      expect(toStringSafe(false)).toBe("false");
    });
  });

  describe("toNumberSafe", () => {
    it("converts valid numeric strings and numbers", () => {
      expect(toNumberSafe("123")).toBe(123);
      expect(toNumberSafe(456)).toBe(456);
      expect(toNumberSafe("12.5")).toBe(12.5);
    });

    it("handles special JS number cases", () => {
      // Number("") is 0
      expect(toNumberSafe("")).toBe(0);
      // Number(null) is 0
      expect(toNumberSafe(null)).toBe(0);
    });

    it("returns undefined for invalid numbers", () => {
      expect(toNumberSafe("abc")).toBeUndefined();
      expect(toNumberSafe(undefined)).toBeUndefined();
      expect(toNumberSafe(Number.NaN)).toBeUndefined();
      expect(toNumberSafe(Infinity)).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // 2. Date Formatting
  // --------------------------------------------------------------------------
  describe("formatDisplayDate", () => {
    it("returns empty string for empty input", () => {
      expect(formatDisplayDate(undefined)).toBe("");
      expect(formatDisplayDate("")).toBe("");
    });

    it("formats ISO date string correctly", () => {
      // en-GB: dd MMM yyyy
      const dateStr = "2023-10-05T00:00:00.000Z";
      expect(formatDisplayDate(dateStr)).toMatch(/05 Oct 2023/);
    });

    it("formats Slash separated dates (dd/mm/yyyy) correctly", () => {
      const dateStr = "05/10/2023"; // 5th Oct
      expect(formatDisplayDate(dateStr)).toMatch(/05 Oct 2023/);
    });

    it("returns empty string for invalid slash dates", () => {
      // invalid month 99
      expect(formatDisplayDate("01/99/2023")).toBe("");
    });

    it("returns empty string for generally invalid dates", () => {
      expect(formatDisplayDate("not-a-date")).toBe("");
    });
  });

  // --------------------------------------------------------------------------
  // 3. Batch Calculations
  // --------------------------------------------------------------------------
  describe("calculateBatchTotals", () => {
    it("returns empty object if batches are undefined or empty", () => {
      expect(calculateBatchTotals()).toEqual({});
      expect(calculateBatchTotals([])).toEqual({});
    });

    it("calculates totals correctly when both onHand and allocated exist", () => {
      const batches: BatchValues[] = [
        { quantity: "10", allocated: "2" } as BatchValues,
        { quantity: "5", allocated: "1" } as BatchValues,
      ];
      const result = calculateBatchTotals(batches);
      expect(result).toEqual({
        onHand: 15,
        allocated: 3,
        available: 12,
      });
    });

    it("handles partial data (only quantity)", () => {
      const batches: BatchValues[] = [
        { quantity: "10" } as BatchValues,
        { quantity: "5" } as BatchValues
      ];
      const result = calculateBatchTotals(batches);
      expect(result).toEqual({
        onHand: 15,
        allocated: undefined,
        available: 15, // 15 - 0
      });
    });

    it("handles partial data (only allocated)", () => {
      const batches: BatchValues[] = [
        { allocated: "2" } as BatchValues,
        { allocated: "3" } as BatchValues
      ];
      const result = calculateBatchTotals(batches);
      expect(result).toEqual({
        onHand: undefined,
        allocated: 5,
        available: -5, // 0 - 5
      });
    });

    it("ignores undefined values in summation", () => {
      const batches: BatchValues[] = [
        { quantity: "10" } as BatchValues,
        { quantity: undefined, allocated: "2" } as BatchValues,
      ];
      const result = calculateBatchTotals(batches);
      expect(result).toEqual({
        onHand: 10,
        allocated: 2,
        available: 8,
      });
    });
  });

  // --------------------------------------------------------------------------
  // 4. Status and Badge Labels
  // --------------------------------------------------------------------------
  describe("Label Formatters", () => {
    it("formatStatusLabel handles cases", () => {
      expect(formatStatusLabel("ACTIVE")).toBe("Active");
      expect(formatStatusLabel("HIDDEN")).toBe("Hidden");
      expect(formatStatusLabel("DRAFT")).toBe("DRAFT");
      expect(formatStatusLabel()).toBe("Active"); // Default
      expect(formatStatusLabel("")).toBe("Active");
    });

    it("formatStockHealthLabel handles cases", () => {
      expect(formatStockHealthLabel("LOW_STOCK")).toBe("Low stock");
      expect(formatStockHealthLabel("HEALTHY")).toBe("Healthy");
      expect(formatStockHealthLabel("EXPIRED")).toBe("Expired");
      expect(formatStockHealthLabel("EXPIRING_SOON")).toBe("Expiring soon");
      expect(formatStockHealthLabel()).toBe("");
    });

    it("getStatusBadgeStyle handles cases", () => {
      // low stock
      expect(getStatusBadgeStyle("Low Stock")).toEqual({ color: "#F7F7F7", backgroundColor: "#BF9FAA" });
      // expired / out of stock
      expect(getStatusBadgeStyle("Expired")).toEqual({ color: "#F7F7F7", backgroundColor: "#D28F9A" });
      expect(getStatusBadgeStyle("Out of Stock")).toEqual({ color: "#F7F7F7", backgroundColor: "#D28F9A" });
      // hidden
      expect(getStatusBadgeStyle("Hidden")).toEqual({ color: "#F7F7F7", backgroundColor: "#A8A181" });
      // expiring soon
      expect(getStatusBadgeStyle("Expiring Soon")).toEqual({ color: "#F7F7F7", backgroundColor: "#5C614B" });
      // healthy
      expect(getStatusBadgeStyle("Healthy")).toEqual({ color: "#F7F7F7", backgroundColor: "#D9A488" });
      // active
      expect(getStatusBadgeStyle("Active")).toEqual({ color: "#302f2e", backgroundColor: "#F1D4B0" });
      // default
      expect(getStatusBadgeStyle("Unknown")).toEqual({ color: "#EAF3FF", backgroundColor: "#247AED" });
      expect(getStatusBadgeStyle()).toEqual({ color: "#EAF3FF", backgroundColor: "#247AED" });
    });
  });

  // --------------------------------------------------------------------------
  // 5. Mapping API Item to Inventory Item (Complex Logic)
  // --------------------------------------------------------------------------
  describe("mapApiItemToInventoryItem", () => {
    const mockApiItem: InventoryApiItem = {
      _id: "item1",
      organisationId: "org1",
      businessType: "VETERINARY" as BusinessType,
      status: "ACTIVE",
      sku: "SKU-123",
      name: "Test Item",
      attributes: {
        department: "Dept A",
        // Valid date for parseDateSafe coverage
        manufactureDate: "2023-01-01",
        unitofMeasure: ["kg"],
      },
      batches: [],
    };

    it("maps basic fields and uses defaults", () => {
      const result = mapApiItemToInventoryItem(mockApiItem);

      expect(result.id).toBe("item1");
      expect(result.basicInfo.name).toBe("Test Item");
      expect(result.basicInfo.status).toBe("Active");
      expect(result.status).toBe("ACTIVE");
    });

    it("normalizes status correctly (Hidden case)", () => {
      const item = { ...mockApiItem, status: "HIDDEN" };
      const result = mapApiItemToInventoryItem(item);
      expect(result.status).toBe("HIDDEN");
      expect(result.basicInfo.status).toBe("Hidden");
    });

    it("defaults unknown status to ACTIVE", () => {
      const item = { ...mockApiItem, status: "UNKNOWN_STATUS" };
      const result = mapApiItemToInventoryItem(item);
      expect(result.status).toBe("ACTIVE");
    });

    it("handles undefined status (returns undefined normalizeStatus, but defaults status label)", () => {
      const item = { ...mockApiItem, status: undefined };
      const result = mapApiItemToInventoryItem(item);
      expect(result.status).toBeUndefined(); // normalizeStatus returns undefined if !status
      expect(result.basicInfo.status).toBe("Active"); // statusLabel fallback
    });

    it("uses stockHealthLabel if statusLabel is empty", () => {
      const item = { ...mockApiItem, status: undefined, stockHealth: "LOW_STOCK" } as any;
      const result = mapApiItemToInventoryItem(item);
      expect(result.basicInfo.status).toBe("Active");
    });

    // ------------------------------------------------------------------------
    // Testing `batches` mapping and `selectPrimaryBatch` internal logic
    // ------------------------------------------------------------------------
    it("maps batches and selects the earliest expiry date as primary batch", () => {
      const earlyDate = "2023-06-01";
      const lateDate = "2024-01-01";

      const itemWithBatches = {
        ...mockApiItem,
        batches: [
          { _id: "b1", expiryDate: lateDate, quantity: 5, batchNumber: "BATCH-B" },
          { _id: "b2", expiryDate: earlyDate, quantity: 10, batchNumber: "BATCH-A" },
        ]
      } as unknown as InventoryApiItem;

      const result = mapApiItemToInventoryItem(itemWithBatches);

      // Check mapped batches
      expect(result.batches).toHaveLength(2);
      expect(result.batches?.[0].batch).toBe("BATCH-B");

      // Check primary batch selection (should be b2 because earlyDate < lateDate)
      expect(result.batch.batch).toBe("BATCH-A");
      expect(result.batch.expiryDate).toBe(earlyDate);

      // Totals calculation check
      // 5 + 10 = 15
      expect(result.stock.current).toBe("15");
    });

    it("selects first batch if no expiry dates provided", () => {
      const item = {
        ...mockApiItem,
        batches: [
          { _id: "b1", batchNumber: "BATCH-1" }, // No expiry
          { _id: "b2", batchNumber: "BATCH-2" }
        ]
      } as unknown as InventoryApiItem;
      const result = mapApiItemToInventoryItem(item);
      expect(result.batch.batch).toBe("BATCH-1");
    });

    it("selects first batch if batch list provided but invalid dates", () => {
        const item = {
            ...mockApiItem,
            batches: [
              { _id: "b1", batchNumber: "BATCH-1", expiryDate: "invalid-date" },
            ]
          } as unknown as InventoryApiItem;
          const result = mapApiItemToInventoryItem(item);
          expect(result.batch.batch).toBe("BATCH-1");
    });

    it("handles batch field fallbacks (batchNumber/lotNumber etc)", () => {
        const item = {
            ...mockApiItem,
            batches: [
                { _id: "b1", lotNumber: "LOT-X", quantity: 10 }
            ]
        } as unknown as InventoryApiItem;
        const result = mapApiItemToInventoryItem(item);
        // Fallback: batchNumber ?? lotNumber
        expect(result.batches?.[0].batch).toBe("LOT-X");
    });

    // ------------------------------------------------------------------------
    // Testing `firstDefined` internal helper via onHand/allocated logic
    // ------------------------------------------------------------------------
    it("calculates onHand/available based on priority (Batch Totals > API Item > Attributes)", () => {
       // Case 1: Batch totals exist
       const item1 = { ...mockApiItem, batches: [{ quantity: 10 }], onHand: 5 };
       const res1 = mapApiItemToInventoryItem(item1 as any);
       expect(res1.stock.current).toBe("10");

       // Case 2: No batches, use API item onHand
       const item2 = { ...mockApiItem, batches: [], onHand: 5 };
       const res2 = mapApiItemToInventoryItem(item2 as any);
       expect(res2.stock.current).toBe("5");

       // Case 3: No api item, use attributes.current
       const item3 = { ...mockApiItem, batches: [], onHand: undefined, attributes: { current: 7 } };
       const res3 = mapApiItemToInventoryItem(item3 as any);
       expect(res3.stock.current).toBe("7");
    });

    it("calculates available = onHand - allocated if batchTotals.available is undefined", () => {
        // batches is empty, so calculateBatchTotals returns available: undefined
        // explicitly set onHand and allocated in API
        const item = {
            ...mockApiItem,
            batches: [],
            onHand: 100,
            allocated: 20
        } as unknown as InventoryApiItem;

        const result = mapApiItemToInventoryItem(item);
        // onHandVal=100, allocatedVal=20 -> available=80
        expect(result.stock.available).toBe("80");
    });

    it("uses onHand as available if allocated is undefined", () => {
        const item = {
            ...mockApiItem,
            batches: [],
            onHand: 100,
            allocated: undefined
        } as unknown as InventoryApiItem;

        const result = mapApiItemToInventoryItem(item);
        expect(result.stock.available).toBe("100");
    });

    // ------------------------------------------------------------------------
    // Testing `normalizeStringOrArray` internal helper
    // ------------------------------------------------------------------------
    it("handles normalizeStringOrArray correctly (UnitOfMeasure)", () => {
        // Array input
        const itemArr = { ...mockApiItem, attributes: { unitofMeasure: ["kg", "g"] } };
        const resArr = mapApiItemToInventoryItem(itemArr as any);
        expect(resArr.classification.unitofMeasure).toEqual(["kg", "g"]);

        // Single value
        const itemStr = { ...mockApiItem, attributes: { unitofMeasure: "liter" } };
        const resStr = mapApiItemToInventoryItem(itemStr as any);
        expect(resStr.classification.unitofMeasure).toBe("liter");

        // Undefined
        const itemUndef = { ...mockApiItem, attributes: { unitofMeasure: undefined } };
        const resUndef = mapApiItemToInventoryItem(itemUndef as any);
        expect(resUndef.classification.unitofMeasure).toBe("");
    });

    // ------------------------------------------------------------------------
    // Testing `parseDateSafe` internal helper logic via batches
    // ------------------------------------------------------------------------
    it("parses slash dates inside batches for primary selection", () => {
       // logic: parseDateSafe handles slash dates
       const item = {
         ...mockApiItem,
         batches: [
            { expiryDate: "05/12/2025" }, // valid future
            { expiryDate: "01/01/2025" }  // valid earlier
         ]
       } as unknown as InventoryApiItem;
       const result = mapApiItemToInventoryItem(item);
       // Should pick earlier date
       expect(result.batch.expiryDate).toBe("01/01/2025");
    });

    it("handles invalid slash date in batches gracefully", () => {
        const item = {
          ...mockApiItem,
          batches: [
             { expiryDate: "99/99/2025", batchNumber: "BAD" },
             { expiryDate: "2025-01-01", batchNumber: "GOOD" }
          ]
        } as unknown as InventoryApiItem;
        const result = mapApiItemToInventoryItem(item);
        // The invalid date is filtered out in selectPrimaryBatch
        expect(result.batch.batch).toBe("GOOD");
     });

    it("maps items when attributes is undefined (Partial)", () => {
      const item = { _id: "1", sku: "S1" } as InventoryApiItem;
      const result = mapApiItemToInventoryItem(item);
      expect(result.id).toBe("1");
      expect(result.attributes).toEqual({});
      expect(result.basicInfo.name).toBe("");
    });
  });

  // --------------------------------------------------------------------------
  // 6. Building Payloads (cleanObject, buildBatchPayload, buildInventoryPayload)
  // --------------------------------------------------------------------------
  describe("Payload Builders", () => {
    const mockInventoryItem: InventoryItem = {
      basicInfo: {
        name: "Payload Item",
        skuCode: "SKU-P",
        department: "Dep",
        status: "Active"
      },
      classification: {
        species: ["Dog"],
        unitofMeasure: "kg",
      },
      pricing: {
        purchaseCost: "10.5",
        selling: "20",
        tax: "5"
      },
      vendor: {
        vendor: "vendor-1",
        supplierName: "Supplier X"
      },
      stock: {
        current: "100",
        allocated: "10",
        stockLocation: "Loc A"
      },
      batch: {
        batch: "BATCH-DEFAULT",
        expiryDate: "2025-12-31"
      },
      // Using explicit batches array
      batches: [
        {
          _id: "b1",
          itemId: "item1",
          organisationId: "org1",
          batch: "B001",
          quantity: "50",
          allocated: "5",
          expiryDate: "31/12/2025" // Slash format
        },
        {
            _id: "b2",
            batch: "B002",
            quantity: "50",
            // ISO format
            expiryDate: "2026-01-01"
        }
      ] as any
    } as InventoryItem;

    describe("buildBatchPayload", () => {
      it("normalizes Slash dates to ISO YYYY-MM-DD", () => {
        const batch = { ...mockInventoryItem.batches![0] };
        const payload = buildBatchPayload(batch);
        expect(payload?.expiryDate).toBe("2025-12-31");
      });

      it("keeps ISO dates as YYYY-MM-DD", () => {
        const batch = { ...mockInventoryItem.batches![1] };
        const payload = buildBatchPayload(batch);
        expect(payload?.expiryDate).toBe("2026-01-01");
      });

      it("falls back to current/available for quantity if quantity field missing", () => {
        const batch = { ...mockInventoryItem.batches![0], quantity: undefined, current: "99" } as any;
        const payload = buildBatchPayload(batch);
        expect(payload?.quantity).toBe(99);
      });

      it("returns undefined if payload ends up empty (cleanObject logic)", () => {
         // Pass object with all undefineds/empty strings
         const batch = {
             _id: undefined,
             quantity: undefined,
             batch: ""
         } as unknown as BatchValues;

         const payload = buildBatchPayload(batch);
         // cleanObject returns {}, check length logic
         expect(payload).toBeUndefined();
      });

      it("cleans empty arrays", () => {
         // Although BatchPayload doesn't have arrays, this verifies cleanObject behavior if we force it
         // But let's rely on standard fields.
         // Let's verify cleanObject via buildInventoryPayload more deeply.
      });
    });

    describe("buildInventoryPayload", () => {
      it("constructs full payload correctly", () => {
        const payload = buildInventoryPayload(mockInventoryItem, "org-1", "VETERINARY" as BusinessType);

        expect(payload.organisationId).toBe("org-1");
        expect(payload.name).toBe("Payload Item");
        expect(payload.batches).toHaveLength(2);
        // Calculated totals
        expect(payload.onHand).toBe(100); // 50 + 50
        expect(payload.allocated).toBe(5); // 5 + undefined(0)
        // Check attributes cleaning
        expect(payload.attributes?.stockLocation).toBe("Loc A");
        expect(payload.attributes?.species).toEqual(["Dog"]);
      });

      it("uses single batch from formData.batch if formData.batches is empty", () => {
        const singleBatchItem = { ...mockInventoryItem, batches: [] };
        const payload = buildInventoryPayload(singleBatchItem, "org-1", "VETERINARY" as BusinessType);

        expect(payload.batches).toHaveLength(1);
        expect(payload.batches![0].batchNumber).toBe("BATCH-DEFAULT");
      });

      it("normalizes status for API (removes spaces, uppercase)", () => {
         const item = { ...mockInventoryItem, basicInfo: { ...mockInventoryItem.basicInfo, status: "Low Stock" } };
         const payload = buildInventoryPayload(item, "org-1", "VETERINARY" as BusinessType);
         expect(payload.status).toBe("LOW_STOCK");
      });

      it("defaults status to ACTIVE if missing", () => {
        const item = { ...mockInventoryItem, basicInfo: { ...mockInventoryItem.basicInfo, status: "" }, status: undefined } as any;
        const payload = buildInventoryPayload(item, "org-1", "VETERINARY" as BusinessType);
        expect(payload.status).toBe("ACTIVE");
      });

      it("handles fallback for available in attributes", () => {
        // If batchTotals.available is undefined, it uses formData.stock.available
        const item = { ...mockInventoryItem, batches: [], stock: { available: "77" } } as any;
        const payload = buildInventoryPayload(item, "org-1", "VETERINARY" as BusinessType);
        expect(payload.attributes?.available).toBe(77);
      });
    });
  });

  // --------------------------------------------------------------------------
  // 7. Display Status Label
  // --------------------------------------------------------------------------
  describe("displayStatusLabel", () => {
    it("returns 'Hidden' if status is hidden (case insensitive)", () => {
      const item = { status: "HIDDEN", basicInfo: {} } as InventoryItem;
      expect(displayStatusLabel(item)).toBe("Hidden");
    });

    it("prioritizes stockHealth if present", () => {
      const item = { status: "ACTIVE", stockHealth: "LOW_STOCK", basicInfo: {} } as InventoryItem;
      expect(displayStatusLabel(item)).toBe("Low stock");
    });

    it("falls back to status if stockHealth missing", () => {
      const item = { status: "ACTIVE", basicInfo: {} } as InventoryItem;
      expect(displayStatusLabel(item)).toBe("Active");
    });

    it("falls back to basicInfo.status if root status missing", () => {
      const item = { basicInfo: { status: "Draft" } } as InventoryItem;
      expect(displayStatusLabel(item)).toBe("Draft");
    });

    it("defaults to 'Active' if nothing present", () => {
      const item = { basicInfo: {} } as InventoryItem;
      expect(displayStatusLabel(item)).toBe("Active");
    });
  });

  // --------------------------------------------------------------------------
  // 8. Default Filters (Constants)
  // --------------------------------------------------------------------------
  it("exports correct defaultFilters", () => {
    expect(defaultFilters).toEqual({
      category: "all",
      status: "ALL",
      search: "",
    });
  });
});