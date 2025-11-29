import {
  AdminstrationOptions,
  AllergenFreeOptions,
  AnimalStageOptions,
  BreedingUseOptions,
  CategoryOptionsByBusiness,
  CoatTypeOptions,
  DepartmentOptions,
  DispenseUnitOptions,
  FormOptions,
  FragranceTypeOptions,
  HeatCycleOptions,
  IntakeTypeOptions,
  IntendedUsageOptions,
  InventoryItem,
  ItemTypeOptions,
  PaymentTermsOptions,
  PetSizeOptions,
  PrescriptionRequiredOptions,
  RegulationTypeOptions,
  SafetyClassificationOptions,
  SpeciesOptions,
  StockLocationOptions,
  StockTypeOptions,
  StorageConditionOptions,
  SubCategoryOptions,
  TemperatureConditionOptions,
  TherapeuticOptions,
  UnitOptions,
  UsageTypeOptions,
  VendorOptions,
} from "../../pages/Inventory/types";
import { BusinessType } from "@/app/types/org";

export type FieldComponentType = "text" | "dropdown" | "textarea" | "date";

export type InventorySectionKey = keyof InventoryItem;

export type FieldNameForSection<S extends InventorySectionKey> =
  keyof InventoryItem[S] & string;

export type FieldDef<S extends InventorySectionKey = InventorySectionKey> = {
  name: FieldNameForSection<S>;
  placeholder?: string;
  label?: string;
  component: FieldComponentType;
  options?: string[];
};

export type ConfigItem<S extends InventorySectionKey = InventorySectionKey> =
  | { kind: "field"; field: FieldDef<S> }
  | { kind: "row"; fields: FieldDef<S>[] };

export type SectionConfig<S extends InventorySectionKey = InventorySectionKey> =
  ConfigItem<S>[];

export const InventoryFormConfig: Record<
  BusinessType,
  Partial<{
    [S in InventorySectionKey]: SectionConfig<S>;
  }>
> = {
  HOSPITAL: {
    basicInfo: [
      {
        kind: "field",
        field: {
          name: "name",
          placeholder: "Item type",
          component: "text",
        },
      },
      {
        kind: "row",
        fields: [
          {
            name: "category",
            placeholder: "Category",
            component: "dropdown",
            options: CategoryOptionsByBusiness.HOSPITAL,
          },
          {
            name: "subCategory",
            placeholder: "Sub category",
            component: "dropdown",
            options: SubCategoryOptions,
          },
        ],
      },
      {
        kind: "row",
        fields: [
          {
            name: "itemType",
            placeholder: "Item type",
            component: "dropdown",
            options: ItemTypeOptions,
          },
          {
            name: "department",
            placeholder: "Department",
            component: "dropdown",
            options: DepartmentOptions,
          },
        ],
      },
      {
        kind: "row",
        fields: [
          {
            name: "prescriptionRequired",
            placeholder: "Prescription",
            component: "dropdown",
            options: PrescriptionRequiredOptions,
          },
          {
            name: "regulationType",
            placeholder: "Reglation type",
            component: "dropdown",
            options: RegulationTypeOptions,
          },
        ],
      },
      {
        kind: "field",
        field: {
          name: "storageCondition",
          placeholder: "Storage condition",
          component: "dropdown",
          options: StorageConditionOptions,
        },
      },
      {
        kind: "field",
        field: {
          name: "description",
          placeholder: "Description",
          component: "textarea",
        },
      },
    ],
    classification: [
      {
        kind: "field",
        field: {
          name: "therapeuticClass",
          placeholder: "Therapeutic class",
          component: "dropdown",
          options: TherapeuticOptions,
        },
      },
      {
        kind: "field",
        field: {
          name: "form",
          placeholder: "Form / Presentation",
          component: "dropdown",
          options: FormOptions,
        },
      },
      {
        kind: "row",
        fields: [
          {
            name: "strength",
            placeholder: "Strength",
            component: "text",
          },
          {
            name: "dosageForm",
            placeholder: "Dosage form",
            component: "text",
          },
        ],
      },
      {
        kind: "row",
        fields: [
          {
            name: "species",
            placeholder: "Species",
            component: "dropdown",
            options: SpeciesOptions,
          },
          {
            name: "administration",
            placeholder: "Administration",
            component: "dropdown",
            options: AdminstrationOptions,
          },
        ],
      },
      {
        kind: "field",
        field: {
          name: "unitofMeasure",
          placeholder: "Unit of Measure (Base)",
          component: "dropdown",
          options: UnitOptions,
        },
      },
      {
        kind: "field",
        field: {
          name: "withdrawlPeriod",
          placeholder: "Withdrawal Period (optional)",
          component: "text",
        },
      },
    ],
    pricing: [
      {
        kind: "field",
        field: {
          name: "purchaseCost",
          placeholder: "Purchase cost (per unit)",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "selling",
          placeholder: "Selling price",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "maxDiscount",
          placeholder: "Max allowable discount (%)",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "tax",
          placeholder: "Tax (%)",
          component: "text",
        },
      },
    ],
    vendor: [
      {
        kind: "field",
        field: {
          name: "supplierName",
          placeholder: "Supplier name",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "brand",
          placeholder: "Brand",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "vendor",
          placeholder: "Vendor type",
          component: "dropdown",
          options: VendorOptions,
        },
      },
      {
        kind: "field",
        field: {
          name: "license",
          placeholder: "License number",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "paymentTerms",
          placeholder: "Payment terms",
          component: "dropdown",
          options: PaymentTermsOptions,
        },
      },
      {
        kind: "field",
        field: {
          name: "leadTime",
          placeholder: "Lead time",
          component: "text",
        },
      },
    ],
    stock: [
      {
        kind: "field",
        field: {
          name: "current",
          placeholder: "Current quantity (on hand)",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "allocated",
          placeholder: "Allocated quantity",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "available",
          placeholder: "Available quantity",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "reorderLevel",
          placeholder: "Reorder level",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "reorderQuantity",
          placeholder: "Reorder quantity (optional)",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "stockLocation",
          placeholder: "Stock location / Storage area",
          component: "dropdown",
          options: StockLocationOptions,
        },
      },
      {
        kind: "field",
        field: {
          name: "stockType",
          placeholder: "Stock type",
          component: "dropdown",
          options: StockTypeOptions,
        },
      },
      {
        kind: "field",
        field: {
          name: "minStockAlert",
          placeholder: "Min stock alert",
          component: "text",
        },
      },
    ],
    batch: [
      {
        kind: "field",
        field: {
          name: "serial",
          placeholder: "Serial / Barcode",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "batch",
          placeholder: "Batch / Lot Number",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "tracking",
          placeholder: "Regulatory tracking ID",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "manufactureDate",
          placeholder: "Manufacture date",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "expiryDate",
          placeholder: "Expiry date",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "nextRefillDate",
          placeholder: "Next refill date",
          component: "text",
        },
      },
    ],
  },
  GROOMER: {
    basicInfo: [
      {
        kind: "field",
        field: {
          name: "name",
          placeholder: "Item type",
          component: "text",
        },
      },
      {
        kind: "row",
        fields: [
          {
            name: "category",
            placeholder: "Category",
            component: "dropdown",
            options: CategoryOptionsByBusiness.GROOMER,
          },
          {
            name: "subCategory",
            placeholder: "Sub category",
            component: "dropdown",
            options: SubCategoryOptions,
          },
        ],
      },
      {
        kind: "field",
        field: {
          name: "department",
          placeholder: "Department",
          component: "dropdown",
          options: DepartmentOptions,
        },
      },
      {
        kind: "row",
        fields: [
          {
            name: "productUsage",
            placeholder: "Product use",
            component: "dropdown",
            options: IntendedUsageOptions.GROOMER,
          },
          {
            name: "coatType",
            placeholder: "Coat type",
            component: "dropdown",
            options: CoatTypeOptions,
          },
        ],
      },
      {
        kind: "row",
        fields: [
          {
            name: "fragranceType",
            placeholder: "Fragrance type",
            component: "dropdown",
            options: FragranceTypeOptions,
          },
          {
            name: "allergenFree",
            placeholder: "Allergen free",
            component: "dropdown",
            options: AllergenFreeOptions,
          },
        ],
      },
      {
        kind: "field",
        field: {
          name: "petSize",
          placeholder: "Pet size",
          component: "dropdown",
          options: PetSizeOptions,
        },
      },
      {
        kind: "field",
        field: {
          name: "description",
          placeholder: "Description",
          component: "textarea",
        },
      },
    ],
    classification: [
      {
        kind: "field",
        field: {
          name: "form",
          placeholder: "Form / Presentation",
          component: "dropdown",
          options: FormOptions,
        },
      },
      {
        kind: "row",
        fields: [
          {
            name: "species",
            placeholder: "Species",
            component: "dropdown",
            options: SpeciesOptions,
          },
          {
            name: "administration",
            placeholder: "Administration",
            component: "dropdown",
            options: AdminstrationOptions,
          },
        ],
      },
      {
        kind: "field",
        field: {
          name: "unitofMeasure",
          placeholder: "Unit of Measure (Base)",
          component: "dropdown",
          options: UnitOptions,
        },
      },
      {
        kind: "field",
        field: {
          name: "dispenseUnit",
          placeholder: "Dispense unit",
          component: "dropdown",
          options: DispenseUnitOptions,
        },
      },
      {
        kind: "field",
        field: {
          name: "packSize",
          placeholder: "Pack size / Quantity per pack",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "usagePerService",
          placeholder: "Usage per service",
          component: "text",
        },
      },
    ],
    pricing: [
      {
        kind: "field",
        field: {
          name: "purchaseCost",
          placeholder: "Purchase cost (per unit)",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "selling",
          placeholder: "Selling price",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "maxDiscount",
          placeholder: "Max allowable discount (%)",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "tax",
          placeholder: "Tax (%)",
          component: "text",
        },
      },
    ],
    vendor: [
      {
        kind: "field",
        field: {
          name: "supplierName",
          placeholder: "Supplier name",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "brand",
          placeholder: "Brand",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "vendor",
          placeholder: "Vendor type",
          component: "dropdown",
          options: VendorOptions,
        },
      },
      {
        kind: "field",
        field: {
          name: "paymentTerms",
          placeholder: "Payment terms",
          component: "dropdown",
          options: PaymentTermsOptions,
        },
      },
      {
        kind: "field",
        field: {
          name: "leadTime",
          placeholder: "Lead time",
          component: "text",
        },
      },
    ],
    stock: [
      {
        kind: "field",
        field: {
          name: "current",
          placeholder: "Current quantity (on hand)",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "allocated",
          placeholder: "Allocated quantity",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "available",
          placeholder: "Available quantity",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "reorderLevel",
          placeholder: "Reorder level",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "reorderQuantity",
          placeholder: "Reorder quantity (optional)",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "stockLocation",
          placeholder: "Stock location / Storage area",
          component: "dropdown",
          options: StockLocationOptions,
        },
      },
      {
        kind: "field",
        field: {
          name: "minStockAlert",
          placeholder: "Min stock alert",
          component: "text",
        },
      },
    ],
    batch: [
      {
        kind: "field",
        field: {
          name: "batch",
          placeholder: "Batch / Lot Number",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "manufactureDate",
          placeholder: "Manufacture date",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "expiryDate",
          placeholder: "Expiry date",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "nextRefillDate",
          placeholder: "Next refill date",
          component: "text",
        },
      },
    ],
  },
  BREEDER: {
    basicInfo: [
      {
        kind: "field",
        field: {
          name: "name",
          placeholder: "Item name",
          component: "text",
        },
      },
      {
        kind: "row",
        fields: [
          {
            name: "category",
            placeholder: "Category",
            component: "dropdown",
            options: CategoryOptionsByBusiness.BOARDER,
          },
          {
            name: "subCategory",
            placeholder: "Sub category",
            component: "dropdown",
            options: SubCategoryOptions,
          },
        ],
      },
      {
        kind: "row",
        fields: [
          {
            name: "itemType",
            placeholder: "Item type",
            component: "dropdown",
            options: ItemTypeOptions,
          },
          {
            name: "department",
            placeholder: "Department",
            component: "dropdown",
            options: DepartmentOptions,
          },
        ],
      },
      {
        kind: "row",
        fields: [
          {
            name: "productUsage",
            placeholder: "Intended use",
            component: "dropdown",
            options: IntendedUsageOptions.BOARDER,
          },
          {
            name: "animalStage",
            placeholder: "Animal stage",
            component: "dropdown",
            options: AnimalStageOptions,
          },
        ],
      },
      {
        kind: "field",
        field: {
          name: "description",
          placeholder: "Description",
          component: "textarea",
        },
      },
    ],
    classification: [
      {
        kind: "field",
        field: {
          name: "breedingUse",
          placeholder: "Breeding use",
          component: "dropdown",
          options: BreedingUseOptions,
        },
      },
      {
        kind: "row",
        fields: [
          {
            name: "form",
            placeholder: "Form / Presentation",
            component: "dropdown",
            options: FormOptions,
          },
          {
            name: "unitofMeasure",
            placeholder: "Unit of Measure (Base)",
            component: "dropdown",
            options: UnitOptions,
          },
        ],
      },
      {
        kind: "field",
        field: {
          name: "strength",
          placeholder: "Strength",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "packSize",
          placeholder: "Pack size / Quantity per pack",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "temperatureCondition",
          placeholder: "Temperature condition",
          component: "dropdown",
          options: TemperatureConditionOptions,
        },
      },
      {
        kind: "row",
        fields: [
          {
            name: "species",
            placeholder: "Species",
            component: "dropdown",
            options: SpeciesOptions,
          },
          {
            name: "usageType",
            placeholder: "Usage type",
            component: "dropdown",
            options: UsageTypeOptions,
          },
        ],
      },
      {
        kind: "field",
        field: {
          name: "litterGroup",
          placeholder: "Litter group / Batch name",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "shelfLife",
          placeholder: "Shelf life (optional)",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "heatCycle",
          placeholder: "Heat cycle kit included",
          component: "dropdown",
          options: HeatCycleOptions,
        },
      },
    ],
    pricing: [
      {
        kind: "field",
        field: {
          name: "purchaseCost",
          placeholder: "Purchase cost (per unit)",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "selling",
          placeholder: "Selling price",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "maxDiscount",
          placeholder: "Max allowable discount (%)",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "tax",
          placeholder: "Tax (%)",
          component: "text",
        },
      },
    ],
    vendor: [
      {
        kind: "field",
        field: {
          name: "supplierName",
          placeholder: "Supplier name",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "brand",
          placeholder: "Brand",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "vendor",
          placeholder: "Vendor type",
          component: "dropdown",
          options: VendorOptions,
        },
      },
      {
        kind: "field",
        field: {
          name: "license",
          placeholder: "Supplier product code",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "paymentTerms",
          placeholder: "Payment terms",
          component: "dropdown",
          options: PaymentTermsOptions,
        },
      },
    ],
    stock: [
      {
        kind: "field",
        field: {
          name: "current",
          placeholder: "Current quantity (on hand)",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "allocated",
          placeholder: "Allocated quantity",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "available",
          placeholder: "Available quantity",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "reorderLevel",
          placeholder: "Reorder level",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "reorderQuantity",
          placeholder: "Reorder quantity (optional)",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "stockLocation",
          placeholder: "Stock location / Storage area",
          component: "dropdown",
          options: StockLocationOptions,
        },
      },
      {
        kind: "field",
        field: {
          name: "minStockAlert",
          placeholder: "Min stock alert",
          component: "text",
        },
      },
    ],
    batch: [
      {
        kind: "field",
        field: {
          name: "batch",
          placeholder: "Batch / Lot Number",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "litterId",
          placeholder: "Manufacture date",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "manufactureDate",
          placeholder: "Associated litter ID",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "expiryDate",
          placeholder: "Expiry date",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "nextRefillDate",
          placeholder: "Next refill date",
          component: "text",
        },
      },
    ],
  },
  BOARDER: {
    basicInfo: [
      {
        kind: "field",
        field: {
          name: "name",
          placeholder: "Item type",
          component: "text",
        },
      },
      {
        kind: "row",
        fields: [
          {
            name: "category",
            placeholder: "Category",
            component: "dropdown",
            options: CategoryOptionsByBusiness.BREEDER,
          },
          {
            name: "subCategory",
            placeholder: "Sub category",
            component: "dropdown",
            options: SubCategoryOptions,
          },
        ],
      },
      {
        kind: "field",
        field: {
          name: "department",
          placeholder: "Department",
          component: "dropdown",
          options: DepartmentOptions,
        },
      },
      {
        kind: "field",
        field: {
          name: "skuCode",
          placeholder: "SKU / Code",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "productUsage",
          placeholder: "Usage location",
          component: "dropdown",
          options: IntendedUsageOptions.BREEDER,
        },
      },
      {
        kind: "field",
        field: {
          name: "description",
          placeholder: "Description",
          component: "textarea",
        },
      },
    ],
    classification: [
      {
        kind: "field",
        field: {
          name: "intakeType",
          placeholder: "Item type",
          component: "dropdown",
          options: IntakeTypeOptions,
        },
      },
      {
        kind: "field",
        field: {
          name: "form",
          placeholder: "Form / Presentation",
          component: "dropdown",
          options: FormOptions,
        },
      },
      {
        kind: "row",
        fields: [
          {
            name: "species",
            placeholder: "Species",
            component: "dropdown",
            options: SpeciesOptions,
          },
          {
            name: "administration",
            placeholder: "Administration",
            component: "dropdown",
            options: AdminstrationOptions,
          },
        ],
      },
      {
        kind: "field",
        field: {
          name: "unitofMeasure",
          placeholder: "Unit of Measure (Base)",
          component: "dropdown",
          options: UnitOptions,
        },
      },
      {
        kind: "field",
        field: {
          name: "safetyClassification",
          placeholder: "Safety classification",
          component: "dropdown",
          options: SafetyClassificationOptions,
        },
      },
      {
        kind: "field",
        field: {
          name: "brand",
          placeholder: "Brand",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "shelfLife",
          placeholder: "Shelf life (optional)",
          component: "text",
        },
      },
    ],
    pricing: [
      {
        kind: "field",
        field: {
          name: "purchaseCost",
          placeholder: "Purchase cost (per unit)",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "selling",
          placeholder: "Selling price",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "maxDiscount",
          placeholder: "Max allowable discount (%)",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "tax",
          placeholder: "Tax (%)",
          component: "text",
        },
      },
    ],
    vendor: [
      {
        kind: "field",
        field: {
          name: "supplierName",
          placeholder: "Supplier name",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "brand",
          placeholder: "Brand",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "vendor",
          placeholder: "Vendor type",
          component: "dropdown",
          options: VendorOptions,
        },
      },
      {
        kind: "field",
        field: {
          name: "paymentTerms",
          placeholder: "Payment terms",
          component: "dropdown",
          options: PaymentTermsOptions,
        },
      },
    ],
    stock: [
      {
        kind: "field",
        field: {
          name: "current",
          placeholder: "Current quantity (on hand)",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "allocated",
          placeholder: "Allocated quantity",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "available",
          placeholder: "Available quantity",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "reorderLevel",
          placeholder: "Reorder level",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "reorderQuantity",
          placeholder: "Reorder quantity (optional)",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "stockLocation",
          placeholder: "Stock location / Storage area",
          component: "dropdown",
          options: StockLocationOptions,
        },
      },
      {
        kind: "field",
        field: {
          name: "minStockAlert",
          placeholder: "Min stock alert",
          component: "text",
        },
      },
    ],
    batch: [
      {
        kind: "field",
        field: {
          name: "batch",
          placeholder: "Batch / Lot Number",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "manufactureDate",
          placeholder: "Manufacture date",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "expiryDate",
          placeholder: "Expiry date",
          component: "text",
        },
      },
      {
        kind: "field",
        field: {
          name: "nextRefillDate",
          placeholder: "Next refill date",
          component: "text",
        },
      },
    ],
  },
};
