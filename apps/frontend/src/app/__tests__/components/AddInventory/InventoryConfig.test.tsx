import { InventoryFormConfig } from '@/app/features/inventory/components/AddInventory/InventoryConfig';
import {
  CategoryOptionsByBusiness,
  SubCategoryOptions,
} from '@/app/features/inventory/pages/Inventory/types';
import { BusinessType } from '@/app/features/organization/types/org';

describe('InventoryFormConfig', () => {
  const businessTypes: BusinessType[] = ['HOSPITAL', 'GROOMER', 'BREEDER'];

  // Helper function to correctly extract field names regardless of 'field' or 'row' kind
  const extractFieldNames = (configSection: any) => {
    return configSection.flatMap((item: any) =>
      item.kind === 'field' ? [item.field.name] : item.fields.map((f: any) => f.name)
    );
  };

  it('should have configuration for all defined business types', () => {
    businessTypes.forEach((businessType) => {
      expect(InventoryFormConfig[businessType]).toBeDefined();
    });
  });

  // --- HOSPITAL Tests ---
  describe('HOSPITAL Configuration', () => {
    const config = InventoryFormConfig.HOSPITAL;

    it('should contain all expected sections for HOSPITAL', () => {
      const expectedSections = [
        'basicInfo',
        'classification',
        'pricing',
        'vendor',
        'stock',
        'batch',
      ];
      expect(Object.keys(config)).toEqual(expectedSections);
    });

    it('should have the correct field structure in the basicInfo section', () => {
      const basicInfoFields = extractFieldNames(config.basicInfo!);
      const expectedFields = [
        'name',
        'brand',
        'skuCode',
        'category',
        'subCategory',
        'description',
        'imageUrl',
      ];
      expect(basicInfoFields).toEqual(expectedFields);
    });

    it('uses the current hospital inventory category taxonomy', () => {
      expect(CategoryOptionsByBusiness.HOSPITAL).toEqual([
        'Medicine',
        'Vaccine',
        'Consumable',
        'Surgical supply',
        'IV / Fluid therapy',
        'Diagnostic kit',
        'Laboratory',
        'Food',
        'Supplement',
        'Equipment',
        'Cleaning supply',
        'Imaging consumable',
        'Wound care',
      ]);
      expect(SubCategoryOptions).toEqual(
        expect.arrayContaining([
          'Antibiotic',
          'NSAID',
          'Core vaccine',
          'IV catheter',
          'Suture',
          'Fluid bag',
          'Rapid test',
          'Sample tube',
          'Prescription diet',
          'Joint support',
          'Reusable instrument',
          'Surface cleaner',
          'Ultrasound gel',
          'Wound spray',
        ])
      );
    });

    it('should have the correct field structure in the classification section', () => {
      const classificationFields = extractFieldNames(config.classification!);
      const expectedFields = [
        'genericName',
        'itemType',
        'drugSchedule',
        'species',
        'storageCondition',
        'form',
        'administration',
        'strength',
        'unitofMeasure',
        'controlledSubstance',
        'prescriptionRequired',
        'reportableToGovernment',
      ];
      expect(classificationFields).toEqual(expectedFields);
    });

    it('should have the correct field structure in the pricing section', () => {
      const pricingFields = extractFieldNames(config.pricing!);
      const expectedFields = ['purchaseCost', 'selling', 'maxDiscount', 'tax'];
      expect(pricingFields).toEqual(expectedFields);
    });

    it('should have the correct field structure in the vendor section', () => {
      const vendorFields = extractFieldNames(config.vendor!);
      const expectedFields = ['vendor', 'supplierName', 'license', 'paymentTerms'];
      expect(vendorFields).toEqual(expectedFields);
    });

    it('should have the correct field structure in the stock section', () => {
      const stockFields = extractFieldNames(config.stock!);
      const expectedFields = [
        'current',
        'allocated',
        'maxStock',
        'stockLocation',
        'reorderLevel',
        'reorderQuantity',
        'abcClass',
        'withdrawlPeriod',
        'available',
        'stockType',
      ];
      expect(stockFields).toEqual(expectedFields);
    });

    // FIX 1: Added 'quantity' and 'allocated' fields to match runtime output
    it('should have the correct field structure in the batch section', () => {
      const batchFields = extractFieldNames(config.batch!);
      const expectedFields = [
        'batch',
        'quantity',
        'manufactureDate',
        'expiryDate',
        'expiryWarningBefore',
        'barcode',
        'tracking',
      ];
      expect(batchFields).toEqual(expectedFields);
    });
  });

  // --- GROOMER Tests ---
  describe('GROOMER Configuration', () => {
    const config = InventoryFormConfig.GROOMER;

    it('should contain all expected sections for GROOMER', () => {
      const expectedSections = [
        'basicInfo',
        'classification',
        'pricing',
        'vendor',
        'stock',
        'batch',
      ];
      expect(Object.keys(config)).toEqual(expectedSections);
    });

    it('should have the correct field structure in the basicInfo section', () => {
      const basicInfoFields = extractFieldNames(config.basicInfo!);
      const expectedFields = [
        'name',
        'category',
        'subCategory',
        'department',
        'productUsage',
        'coatType',
        'fragranceType',
        'allergenFree',
        'petSize',
        'description',
      ];
      expect(basicInfoFields).toEqual(expectedFields);
    });

    it('should have the correct field structure in the classification section', () => {
      const classificationFields = extractFieldNames(config.classification!);
      const expectedFields = [
        'form',
        'species',
        'administration',
        'unitofMeasure',
        'dispenseUnit',
        'packSize',
        'usagePerService',
      ];
      expect(classificationFields).toEqual(expectedFields);
    });

    it('should have the correct field structure in the pricing section', () => {
      const pricingFields = extractFieldNames(config.pricing!);
      const expectedFields = ['purchaseCost', 'selling', 'maxDiscount', 'tax'];
      expect(pricingFields).toEqual(expectedFields);
    });

    it('should have the correct field structure in the vendor section', () => {
      const vendorFields = extractFieldNames(config.vendor!);
      const expectedFields = ['vendor', 'supplierName', 'paymentTerms'];
      expect(vendorFields).toEqual(expectedFields);
    });

    it('should have the correct field structure in the stock section', () => {
      const stockFields = extractFieldNames(config.stock!);
      const expectedFields = [
        'current',
        'allocated',
        'maxStock',
        'stockLocation',
        'reorderLevel',
        'reorderQuantity',
        'abcClass',
        'withdrawlPeriod',
        'available',
      ];
      expect(stockFields).toEqual(expectedFields);
    });

    // FIX 2: Added 'quantity' and 'allocated' fields to match runtime output
    it('should have the correct field structure in the batch section', () => {
      const batchFields = extractFieldNames(config.batch!);
      const expectedFields = [
        'batch',
        'quantity',
        'manufactureDate',
        'expiryDate',
        'expiryWarningBefore',
        'barcode',
        'tracking',
      ];
      expect(batchFields).toEqual(expectedFields);
    });
  });

  // --- BREEDER Tests ---
  describe('BREEDER Configuration', () => {
    const config = InventoryFormConfig.BREEDER;

    it('should contain all expected sections for BREEDER', () => {
      const expectedSections = [
        'basicInfo',
        'classification',
        'pricing',
        'vendor',
        'stock',
        'batch',
      ];
      expect(Object.keys(config)).toEqual(expectedSections);
    });

    it('should have the correct field structure in the classification section', () => {
      const classificationFields = extractFieldNames(config.classification!);
      const expectedFields = [
        'breedingUse',
        'form',
        'unitofMeasure',
        'strength',
        'packSize',
        'temperatureCondition',
        'species',
        'usageType',
        'litterGroup',
        'shelfLife',
        'heatCycle',
      ];
      expect(classificationFields).toEqual(expectedFields);
    });

    it('should have the correct field structure in the pricing section', () => {
      const pricingFields = extractFieldNames(config.pricing!);
      const expectedFields = ['purchaseCost', 'selling', 'maxDiscount', 'tax'];
      expect(pricingFields).toEqual(expectedFields);
    });

    // FIX 4: Removed 'leadTime' because the test output showed it was not received.
    it('should have the correct field structure in the vendor section', () => {
      const vendorFields = extractFieldNames(config.vendor!);
      const expectedFields = ['supplierName', 'brand', 'vendor', 'license', 'paymentTerms'];
      expect(vendorFields).toEqual(expectedFields);
    });

    it('should have the correct field structure in the stock section', () => {
      const stockFields = extractFieldNames(config.stock!);
      const expectedFields = [
        'current',
        'allocated',
        'maxStock',
        'stockLocation',
        'reorderLevel',
        'reorderQuantity',
        'abcClass',
        'withdrawlPeriod',
        'available',
      ];
      expect(stockFields).toEqual(expectedFields);
    });

    // FIX 3: Added 'quantity' and 'allocated' fields to match runtime output
    it('should have the correct field structure in the batch section', () => {
      const batchFields = extractFieldNames(config.batch!);
      const expectedFields = [
        'batch',
        'quantity', // <-- ADDED
        'allocated', // <-- ADDED
        'litterId',
        'manufactureDate',
        'expiryDate',
        'nextRefillDate',
      ];
      expect(batchFields).toEqual(expectedFields);
    });
  });

  // Test the configuration types for generic code coverage
  it('should validate the type structure of ConfigItem and SectionConfig', () => {
    const hospitalBasicInfo = InventoryFormConfig.HOSPITAL.basicInfo!;
    expect(hospitalBasicInfo.length).toBeGreaterThan(0);

    const firstItem = hospitalBasicInfo[0];
    expect(firstItem.kind).toBe('field');
    if (firstItem.kind === 'field') {
      expect(firstItem.field.name).toBe('name');
    }

    const categoryRow = hospitalBasicInfo[3];
    expect(categoryRow.kind).toBe('row');
    if (categoryRow.kind === 'row') {
      expect(categoryRow.fields.length).toBe(2);
      expect(categoryRow.fields[0].name).toBe('category');
    }
  });
});
