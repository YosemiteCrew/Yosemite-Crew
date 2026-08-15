import { describe, expect, it } from "@jest/globals";
import {
  calculateInventoryStockStatus,
  getInventoryCategories,
} from "../../src/services/inventory.catalog";

describe("inventory.catalog", () => {
  it("slugifies category and subcategory names consistently", () => {
    const categories = getInventoryCategories();

    expect(categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "IV / Fluid therapy",
          code: "iv-fluid-therapy",
          subcategories: expect.arrayContaining([
            expect.objectContaining({
              name: "Giving set",
              code: "giving-set",
            }),
          ]),
        }),
        expect.objectContaining({
          name: "Imaging consumable",
          subcategories: expect.arrayContaining([
            expect.objectContaining({
              name: "X-ray consumable",
              code: "x-ray-consumable",
            }),
          ]),
        }),
      ]),
    );
  });

  describe("calculateInventoryStockStatus", () => {
    const base = { active: true, currentStock: 10 };

    it("returns Inactive for inactive items regardless of stock", () => {
      expect(
        calculateInventoryStockStatus({ active: false, currentStock: 10 }),
      ).toBe("Inactive");
    });

    it("returns Out of stock when current stock is zero or negative", () => {
      expect(
        calculateInventoryStockStatus({ active: true, currentStock: 0 }),
      ).toBe("Out of stock");
    });

    it("returns Expired for a past expiry Date instance", () => {
      expect(
        calculateInventoryStockStatus({
          ...base,
          expiryDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        }),
      ).toBe("Expired");
    });

    it("returns Expiring soon for an expiry date string inside the window", () => {
      expect(
        calculateInventoryStockStatus({
          ...base,
          expiryDate: new Date(
            Date.now() + 5 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          expiringSoonDays: 30,
        }),
      ).toBe("Expiring soon");
    });

    it("ignores unparseable expiry strings and falls through to stock checks", () => {
      expect(
        calculateInventoryStockStatus({
          ...base,
          expiryDate: "not-a-date",
          minimumStock: 10,
        }),
      ).toBe("Low stock");
    });

    it("returns Low stock when at or below the minimum stock", () => {
      expect(
        calculateInventoryStockStatus({
          ...base,
          minimumStock: 10,
        }),
      ).toBe("Low stock");
    });

    it("returns In stock when no thresholds are hit and expiry is far away", () => {
      expect(
        calculateInventoryStockStatus({
          ...base,
          minimumStock: 2,
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        }),
      ).toBe("In stock");
    });

    it("returns In stock when the expiry date is null and no minimum is set", () => {
      expect(
        calculateInventoryStockStatus({
          ...base,
          expiryDate: null,
        }),
      ).toBe("In stock");
    });
  });
});
