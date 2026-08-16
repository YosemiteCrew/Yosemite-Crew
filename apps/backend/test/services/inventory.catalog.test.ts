import { describe, expect, it } from "@jest/globals";
import {
  INVENTORY_CATEGORY_SEED,
  calculateInventoryStockStatus,
  calculatePricingMetrics,
  getInventoryCategories,
  getInventoryCategorySeed,
  getInventorySubcategories,
  isMedicalInventoryCategory,
  normalizeInventoryCategoryName,
  validateInventoryCategorySelection,
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

    it("returns In stock when the expiry date is omitted entirely", () => {
      expect(calculateInventoryStockStatus({ ...base })).toBe("In stock");
    });

    it("prefers Expired over Low stock when both conditions hold", () => {
      expect(
        calculateInventoryStockStatus({
          active: true,
          currentStock: 1,
          minimumStock: 5,
          expiryDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        }),
      ).toBe("Expired");
    });

    it("honours a custom expiring-soon window", () => {
      const inTenDays = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

      expect(
        calculateInventoryStockStatus({
          ...base,
          expiryDate: inTenDays,
          expiringSoonDays: 5,
        }),
      ).toBe("In stock");
      expect(
        calculateInventoryStockStatus({
          ...base,
          expiryDate: inTenDays,
          expiringSoonDays: 20,
        }),
      ).toBe("Expiring soon");
    });

    it("treats a negative stock level as out of stock even when inactive is false", () => {
      expect(
        calculateInventoryStockStatus({ active: true, currentStock: -4 }),
      ).toBe("Out of stock");
    });
  });

  describe("normalizeInventoryCategoryName", () => {
    it.each([
      ["  Medicine  ", "Medicine"],
      ["\tVaccine\n", "Vaccine"],
      ["Wound care", "Wound care"],
      ["   ", ""],
      ["", ""],
    ])("trims %j to %j", (input, expected) => {
      expect(normalizeInventoryCategoryName(input)).toBe(expected);
    });

    it("does not change internal spacing or casing", () => {
      expect(normalizeInventoryCategoryName(" IV / Fluid therapy ")).toBe(
        "IV / Fluid therapy",
      );
    });
  });

  describe("getInventoryCategorySeed", () => {
    it("resolves a seed case-insensitively and ignoring surrounding whitespace", () => {
      expect(getInventoryCategorySeed("  mEdIcInE  ")).toEqual(
        expect.objectContaining({
          name: "Medicine",
          code: "medicine",
          isMedical: true,
          sortOrder: 10,
        }),
      );
    });

    it("returns the same seed object that backs INVENTORY_CATEGORY_SEED", () => {
      const seed = INVENTORY_CATEGORY_SEED.find(
        (entry) => entry.name === "Laboratory",
      );

      expect(getInventoryCategorySeed("Laboratory")).toBe(seed);
    });

    it.each(["Unknown category", "", "   ", "medicines"])(
      "returns null for the unknown category %j",
      (name) => {
        expect(getInventoryCategorySeed(name)).toBeNull();
      },
    );
  });

  describe("getInventorySubcategories", () => {
    it("returns the seeded subcategory list for a known category", () => {
      expect(getInventorySubcategories("vaccine")).toEqual(
        expect.arrayContaining(["Rabies", "DHPP", "Core vaccine"]),
      );
    });

    it("returns an empty list for an unknown category", () => {
      expect(getInventorySubcategories("Spaceship parts")).toEqual([]);
    });
  });

  describe("isMedicalInventoryCategory", () => {
    it.each([
      ["Medicine", true],
      ["Vaccine", true],
      ["Diagnostic kit", true],
      ["Laboratory", true],
      ["Consumable", false],
      ["Cleaning supply", false],
      ["Not a category", false],
    ])("reports %j as medical=%s", (name, expected) => {
      expect(isMedicalInventoryCategory(name)).toBe(expected);
    });
  });

  describe("validateInventoryCategorySelection", () => {
    it("reports an unknown category as non-existent but does not fail the subcategory", () => {
      expect(
        validateInventoryCategorySelection("Nonsense", "Whatever"),
      ).toEqual({
        categoryExists: false,
        subcategoryValid: true,
      });
    });

    it.each([
      ["undefined", undefined],
      ["null", null],
      ["empty string", ""],
    ])(
      "accepts a known category when the subcategory is %s",
      (_label, subcategory) => {
        expect(
          validateInventoryCategorySelection("Medicine", subcategory),
        ).toEqual({
          categoryExists: true,
          subcategoryValid: true,
        });
      },
    );

    it("accepts a subcategory ignoring case and surrounding whitespace", () => {
      expect(
        validateInventoryCategorySelection("Medicine", "  aNtIbIoTiC  "),
      ).toEqual({
        categoryExists: true,
        subcategoryValid: true,
      });
    });

    it("rejects a subcategory that belongs to a different category", () => {
      expect(validateInventoryCategorySelection("Medicine", "Rabies")).toEqual({
        categoryExists: true,
        subcategoryValid: false,
      });
    });

    it("rejects a subcategory that exists nowhere in the seed", () => {
      expect(
        validateInventoryCategorySelection("Consumable", "Warp core"),
      ).toEqual({
        categoryExists: true,
        subcategoryValid: false,
      });
    });
  });

  describe("calculatePricingMetrics", () => {
    it("computes gross profit and margin for a profitable item", () => {
      expect(
        calculatePricingMetrics({ sellingPrice: 200, costPrice: 50 }),
      ).toEqual({
        grossProfit: 150,
        marginPercentage: 75,
      });
    });

    it("reports a negative margin when the cost exceeds the selling price", () => {
      expect(
        calculatePricingMetrics({ sellingPrice: 100, costPrice: 150 }),
      ).toEqual({
        grossProfit: -50,
        marginPercentage: -50,
      });
    });

    it("treats a missing cost price as zero and yields a full margin", () => {
      expect(calculatePricingMetrics({ sellingPrice: 80 })).toEqual({
        grossProfit: 80,
        marginPercentage: 100,
      });

      expect(
        calculatePricingMetrics({ sellingPrice: 80, costPrice: null }),
      ).toEqual({
        grossProfit: 80,
        marginPercentage: 100,
      });
    });

    it.each([
      ["zero", 0],
      ["negative", -10],
      ["null", null],
      ["undefined", undefined],
    ])(
      "returns a null margin when the selling price is %s",
      (_label, sellingPrice) => {
        const result = calculatePricingMetrics({ sellingPrice, costPrice: 25 });

        expect(result.marginPercentage).toBeNull();
        expect(result.grossProfit).toBe((sellingPrice ?? 0) - 25);
      },
    );

    it("returns a zero gross profit and null margin when both prices are absent", () => {
      expect(calculatePricingMetrics({})).toEqual({
        grossProfit: 0,
        marginPercentage: null,
      });
    });
  });

  describe("getInventoryCategories", () => {
    it("mirrors the seed order, flags and one-based subcategory ordering", () => {
      const categories = getInventoryCategories();

      expect(categories).toHaveLength(INVENTORY_CATEGORY_SEED.length);
      expect(categories.map((entry) => entry.name)).toEqual(
        INVENTORY_CATEGORY_SEED.map((entry) => entry.name),
      );

      const medicine = categories[0];
      expect(medicine).toEqual(
        expect.objectContaining({
          name: "Medicine",
          code: "medicine",
          isMedical: true,
          sortOrder: 10,
        }),
      );
      expect(medicine.subcategories[0]).toEqual({
        name: "Antibiotic",
        code: "antibiotic",
        sortOrder: 1,
        isActive: true,
      });
      expect(
        medicine.subcategories.map((subcategory) => subcategory.sortOrder),
      ).toEqual(medicine.subcategories.map((_subcategory, index) => index + 1));
      expect(
        categories.every((entry) =>
          entry.subcategories.every((subcategory) => subcategory.isActive),
        ),
      ).toBe(true);
    });

    it("slugifies punctuation and ampersands out of subcategory codes", () => {
      const supplement = getInventoryCategories().find(
        (entry) => entry.name === "Supplement",
      );

      expect(supplement?.subcategories).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "Skin & coat", code: "skin-coat" }),
        ]),
      );
    });
  });
});
