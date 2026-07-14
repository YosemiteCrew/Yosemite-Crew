import { describe, expect, it } from "@jest/globals";
import { getInventoryCategories } from "../../src/services/inventory.catalog";

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
});
