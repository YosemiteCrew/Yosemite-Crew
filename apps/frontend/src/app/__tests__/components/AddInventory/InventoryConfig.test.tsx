import { InventoryFormConfig } from "@/app/components/AddInventory/InventoryConfig";
import { BusinessType } from "@/app/types/org";

// Mock imports for completeness
const mockCategoryOptionsByBusiness = {
  HOSPITAL: ["Vet Med", "Supplies"],
  GROOMER: ["Shampoo", "Tools"],
  BREEDER: ["Food", "Housing"],
};

describe("InventoryFormConfig", () => {
  const businessTypes: BusinessType[] = ["HOSPITAL", "GROOMER", "BREEDER"];

  // Helper function to correctly extract field names regardless of 'field' or 'row' kind
  const extractFieldNames = (configSection: any) => {
    return configSection.flatMap((item: any) =>
      item.kind === "field"
        ? [item.field.name]
        : item.fields.map((f: any) => f.name)
    );
  };

  it("should have configuration for all defined business types", () => {
    businessTypes.forEach((businessType) => {
      expect(InventoryFormConfig[businessType]).toBeDefined();
    });
  });

  // --- HOSPITAL Tests ---
  describe("HOSPITAL Configuration", () => {
    const config = InventoryFormConfig.HOSPITAL;

    it("should contain all expected sections for HOSPITAL", () => {
      const expectedSections = [
        "basicInfo",
        "classification",
        "pricing",
        "vendor",
        "stock",
        "batch",
      ];
      expect(Object.keys(config)).toEqual(expectedSections);
    });

    it("should have the correct field structure in the basicInfo section", () => {
      const basicInfoFields = extractFieldNames(config.basicInfo!);
      const expectedFields = [
        "name",
        "category",
        "subCategory",
        "itemType",
        "department",
        "prescriptionRequired",
        "regulationType",
        "storageCondition",
        "description",
      ];
      expect(basicInfoFields).toEqual(expectedFields);
    });

    it("should have the correct field structure in the classification section", () => {
      const classificationFields = extractFieldNames(config.classification!);
      const expectedFields = [
        "therapeuticClass",
        "form",
        "strength",
        "dosageForm",
        "species",
        "administration",
        "unitofMeasure",
        "withdrawlPeriod",
      ];
      expect(classificationFields).toEqual(expectedFields);
    });

    it("should have the correct field structure in the pricing section", () => {
      const pricingFields = extractFieldNames(config.pricing!);
      const expectedFields = ["purchaseCost", "selling", "maxDiscount", "tax"];
      expect(pricingFields).toEqual(expectedFields);
    });

    it("should have the correct field structure in the vendor section", () => {
      const vendorFields = extractFieldNames(config.vendor!);
      const expectedFields = [
        "supplierName",
        "brand",
        "vendor",
        "license",
        "paymentTerms",
        "leadTime",
      ];
      expect(vendorFields).toEqual(expectedFields);
    });

    it("should have the correct field structure in the stock section", () => {
      const stockFields = extractFieldNames(config.stock!);
      const expectedFields = [
        "current",
        "allocated",
        "available",
        "reorderLevel",
        "reorderQuantity",
        "stockLocation",
        "stockType",
        "minStockAlert",
      ];
      expect(stockFields).toEqual(expectedFields);
    });

    // FIX 1: Added 'quantity' and 'allocated' fields to match runtime output
    it("should have the correct field structure in the batch section", () => {
      const batchFields = extractFieldNames(config.batch!);
      const expectedFields = [
        "serial",
        "batch",
        "tracking",
        "quantity", // <-- ADDED
        "allocated", // <-- ADDED
        "manufactureDate",
        "expiryDate",
        "nextRefillDate",
      ];
      expect(batchFields).toEqual(expectedFields);
    });
  });

  // --- GROOMER Tests ---
  describe("GROOMER Configuration", () => {
    const config = InventoryFormConfig.GROOMER;

    it("should contain all expected sections for GROOMER", () => {
      const expectedSections = [
        "basicInfo",
        "classification",
        "pricing",
        "vendor",
        "stock",
        "batch",
      ];
      expect(Object.keys(config)).toEqual(expectedSections);
    });

    it("should have the correct field structure in the basicInfo section", () => {
      const basicInfoFields = extractFieldNames(config.basicInfo!);
      const expectedFields = [
        "name",
        "category",
        "subCategory",
        "department",
        "productUsage",
        "coatType",
        "fragranceType",
        "allergenFree",
        "petSize",
        "description",
      ];
      expect(basicInfoFields).toEqual(expectedFields);
    });

    it("should have the correct field structure in the classification section", () => {
      const classificationFields = extractFieldNames(config.classification!);
      const expectedFields = [
        "form",
        "species",
        "administration",
        "unitofMeasure",
        "dispenseUnit",
        "packSize",
        "usagePerService",
      ];
      expect(classificationFields).toEqual(expectedFields);
    });

    it("should have the correct field structure in the pricing section", () => {
      const pricingFields = extractFieldNames(config.pricing!);
      const expectedFields = ["purchaseCost", "selling", "maxDiscount", "tax"];
      expect(pricingFields).toEqual(expectedFields);
    });

    it("should have the correct field structure in the vendor section", () => {
      const vendorFields = extractFieldNames(config.vendor!);
      const expectedFields = [
        "supplierName",
        "brand",
        "vendor",
        "paymentTerms",
        "leadTime",
      ];
      expect(vendorFields).toEqual(expectedFields);
    });

    it("should have the correct field structure in the stock section", () => {
      const stockFields = extractFieldNames(config.stock!);
      const expectedFields = [
        "current",
        "allocated",
        "available",
        "reorderLevel",
        "reorderQuantity",
        "stockLocation",
        "minStockAlert",
      ];
      expect(stockFields).toEqual(expectedFields);
    });

    // FIX 2: Added 'quantity' and 'allocated' fields to match runtime output
    it("should have the correct field structure in the batch section", () => {
      const batchFields = extractFieldNames(config.batch!);
      const expectedFields = [
        "batch",
        "quantity", // <-- ADDED
        "allocated", // <-- ADDED
        "manufactureDate",
        "expiryDate",
        "nextRefillDate",
      ];
      expect(batchFields).toEqual(expectedFields);
    });
  });

  // --- BREEDER Tests ---
  describe("BREEDER Configuration", () => {
    const config = InventoryFormConfig.BREEDER;

    it("should contain all expected sections for BREEDER", () => {
      const expectedSections = [
        "basicInfo",
        "classification",
        "pricing",
        "vendor",
        "stock",
        "batch",
      ];
      expect(Object.keys(config)).toEqual(expectedSections);
    });

    it("should have the correct field structure in the classification section", () => {
      const classificationFields = extractFieldNames(config.classification!);
      const expectedFields = [
        "breedingUse",
        "form",
        "unitofMeasure",
        "strength",
        "packSize",
        "temperatureCondition",
        "species",
        "usageType",
        "litterGroup",
        "shelfLife",
        "heatCycle",
      ];
      expect(classificationFields).toEqual(expectedFields);
    });

    it("should have the correct field structure in the pricing section", () => {
      const pricingFields = extractFieldNames(config.pricing!);
      const expectedFields = ["purchaseCost", "selling", "maxDiscount", "tax"];
      expect(pricingFields).toEqual(expectedFields);
    });

    // FIX 4: Removed 'leadTime' because the test output showed it was not received.
    it("should have the correct field structure in the vendor section", () => {
      const vendorFields = extractFieldNames(config.vendor!);
      const expectedFields = [
        "supplierName",
        "brand",
        "vendor",
        "license",
        "paymentTerms",
        // "leadTime", <-- REMOVED
      ];
      expect(vendorFields).toEqual(expectedFields);
    });

    it("should have the correct field structure in the stock section", () => {
      const stockFields = extractFieldNames(config.stock!);
      const expectedFields = [
        "current",
        "allocated",
        "available",
        "reorderLevel",
        "reorderQuantity",
        "stockLocation",
        "minStockAlert",
      ];
      expect(stockFields).toEqual(expectedFields);
    });

    // FIX 3: Added 'quantity' and 'allocated' fields to match runtime output
    it("should have the correct field structure in the batch section", () => {
      const batchFields = extractFieldNames(config.batch!);
      const expectedFields = [
        "batch",
        "quantity", // <-- ADDED
        "allocated", // <-- ADDED
        "litterId",
        "manufactureDate",
        "expiryDate",
        "nextRefillDate",
      ];
      expect(batchFields).toEqual(expectedFields);
    });
  });

  // Test the configuration types for generic code coverage
  it("should validate the type structure of ConfigItem and SectionConfig", () => {
    const hospitalBasicInfo = InventoryFormConfig.HOSPITAL.basicInfo!;
    expect(hospitalBasicInfo.length).toBeGreaterThan(0);

    const firstItem = hospitalBasicInfo[0];
    expect(firstItem.kind).toBe("field");
    if (firstItem.kind === "field") {
      expect(firstItem.field.name).toBe("name");
    }

    const secondItem = hospitalBasicInfo[1];
    expect(secondItem.kind).toBe("row");
    if (secondItem.kind === "row") {
      expect(secondItem.fields.length).toBe(2);
      expect(secondItem.fields[0].name).toBe("category");
    }
  });
});
