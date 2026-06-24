import {
  AdminstrationOptions,
  AbcClassOptions,
  AllergenFreeOptions,
  AnimalStageOptions,
  BreedingUseOptions,
  CategoryOptionsByBusiness,
  CoatTypeOptions,
  DepartmentOptions,
  DispenseUnitOptions,
  DrugScheduleOptions,
  ExpiryWarningOptions,
  FormOptions,
  FragranceTypeOptions,
  HeatCycleOptions,
  IntakeTypeOptions,
  IntendedUsageOptions,
  InventoryItem,
  ItemTypeOptions,
  PaymentTermsOptions,
  PetSizeOptions,
  SafetyClassificationOptions,
  SpeciesOptions,
  StockLocationOptions,
  StockTypeOptions,
  StorageConditionOptions,
  SubCategoryOptions,
  TemperatureConditionOptions,
  UnitOptions,
  UsageTypeOptions,
  VendorOptions,
  WithdrawalPeriodOptions,
} from '@/app/features/inventory/pages/Inventory/types';
import { BusinessType } from '@/app/features/organization/types/org';

export type FieldComponentType =
  | 'text'
  | 'dropdown'
  | 'textarea'
  | 'date'
  | 'multiSelect'
  | 'checkbox'
  | 'upload';

export type InventorySectionKey =
  | 'basicInfo'
  | 'classification'
  | 'pricing'
  | 'vendor'
  | 'stock'
  | 'batch';

export type FieldNameForSection<S extends InventorySectionKey> = keyof InventoryItem[S] & string;

export type FieldDef<S extends InventorySectionKey = InventorySectionKey> = {
  name: FieldNameForSection<S>;
  placeholder?: string;
  label?: string;
  component: FieldComponentType;
  options?: string[];
  readonly?: boolean;
};

export type ConfigItem<S extends InventorySectionKey = InventorySectionKey> =
  | { kind: 'field'; field: FieldDef<S> }
  | { kind: 'row'; fields: FieldDef<S>[] };

export type SectionConfig<S extends InventorySectionKey = InventorySectionKey> = ConfigItem<S>[];

const field = <S extends InventorySectionKey>(
  name: FieldNameForSection<S>,
  placeholder: string,
  component: FieldComponentType,
  options?: string[]
): ConfigItem<S> => ({
  kind: 'field',
  field: { name, placeholder, component, options },
});

const row = <S extends InventorySectionKey>(...fields: FieldDef<S>[]): ConfigItem<S> => ({
  kind: 'row',
  fields,
});

const readonlyField = <S extends InventorySectionKey>(
  name: FieldNameForSection<S>,
  placeholder: string,
  component: FieldComponentType,
  options?: string[]
): ConfigItem<S> => ({
  kind: 'field',
  field: { name, placeholder, component, options, readonly: true },
});

const f = <S extends InventorySectionKey>(
  name: FieldNameForSection<S>,
  placeholder: string,
  component: FieldComponentType,
  options?: string[]
): FieldDef<S> => ({ name, placeholder, component, options });

const commonPricingFields: SectionConfig<'pricing'> = [
  field('purchaseCost', 'Unit cost', 'text'),
  field('selling', 'Selling price', 'text'),
  field('maxDiscount', 'Max. discount %', 'text'),
  field('tax', 'Tax (%)', 'text'),
];

const commonVendorFields = (includesLicense: boolean): SectionConfig<'vendor'> => [
  field('vendor', 'Vendor type', 'dropdown', VendorOptions),
  field('supplierName', 'Vendor name', 'text'),
  ...(includesLicense ? [field<'vendor'>('license', 'License number', 'text')] : []),
  field('paymentTerms', 'Payment terms', 'dropdown', PaymentTermsOptions),
];

const commonStockFields = (includesStockType: boolean = false): SectionConfig<'stock'> => [
  row(f('current', 'On hand stock', 'text'), f('allocated', 'Allocated stock (optional)', 'text')),
  row(
    f('maxStock', 'Max stock', 'text'),
    f('stockLocation', 'Stock location', 'dropdown', StockLocationOptions)
  ),
  row(
    f('reorderLevel', 'Reorder point', 'text'),
    f('reorderQuantity', 'Reorder quantity (optional)', 'text')
  ),
  field('abcClass', 'ABC Class', 'dropdown', AbcClassOptions),
  field('withdrawlPeriod', 'Withdrawal period (optional)', 'dropdown', WithdrawalPeriodOptions),
  readonlyField('available', 'Available stock', 'text'),
  ...(includesStockType
    ? [
        row<'stock'>(
          {
            name: 'stockType',
            placeholder: 'Stock unit type',
            component: 'dropdown',
            options: StockTypeOptions,
          },
          { name: 'unitQnt', placeholder: 'Unit qnt', component: 'text' }
        ),
      ]
    : []),
];

const commonBatchFields: SectionConfig<'batch'> = [
  row(f('batch', 'Batch/ Lot number', 'text'), f('quantity', 'Batch quantity', 'text')),
  row(f('manufactureDate', 'Manufacturing date', 'date'), f('expiryDate', 'Expiry date', 'date')),
  field('expiryWarningBefore', 'Expiring warning before', 'dropdown', ExpiryWarningOptions),
  field('barcode', 'Barcode', 'text'),
  field('tracking', 'Regulatory tracking ID', 'text'),
];

export const InventoryFormConfig: Record<
  BusinessType,
  Partial<{
    [S in InventorySectionKey]: SectionConfig<S>;
  }>
> = {
  HOSPITAL: {
    basicInfo: [
      {
        kind: 'field',
        field: {
          name: 'name',
          placeholder: 'Item name',
          component: 'text',
        },
      },
      {
        kind: 'field',
        field: {
          name: 'brand',
          placeholder: 'Brand (optional)',
          component: 'text',
        },
      },
      {
        kind: 'field',
        field: {
          name: 'skuCode',
          placeholder: 'SKU (optional)',
          component: 'text',
        },
      },
      {
        kind: 'row',
        fields: [
          {
            name: 'category',
            placeholder: 'Category',
            component: 'dropdown',
            options: CategoryOptionsByBusiness.HOSPITAL,
          },
          {
            name: 'subCategory',
            placeholder: 'Sub category',
            component: 'dropdown',
            options: SubCategoryOptions,
          },
        ],
      },
      {
        kind: 'field',
        field: {
          name: 'description',
          placeholder: 'Description (optional)',
          component: 'textarea',
        },
      },
      {
        kind: 'field',
        field: {
          name: 'imageUrl',
          placeholder: 'Product image (optional)',
          component: 'upload',
        },
      },
    ],
    classification: [
      field('genericName', 'Generic name', 'text'),
      {
        kind: 'row',
        fields: [
          {
            name: 'itemType',
            placeholder: 'Item type',
            component: 'dropdown',
            options: ItemTypeOptions,
          },
          {
            name: 'drugSchedule',
            placeholder: 'Drug schedule',
            component: 'dropdown',
            options: DrugScheduleOptions,
          },
        ],
      },
      {
        kind: 'field',
        field: {
          name: 'species',
          placeholder: 'Species',
          component: 'multiSelect',
          options: SpeciesOptions,
        },
      },
      {
        kind: 'field',
        field: {
          name: 'storageCondition',
          placeholder: 'Storage condition',
          component: 'dropdown',
          options: StorageConditionOptions,
        },
      },
      {
        kind: 'row',
        fields: [
          {
            name: 'form',
            placeholder: 'Form',
            component: 'dropdown',
            options: FormOptions,
          },
          {
            name: 'administration',
            placeholder: 'Administration route',
            component: 'dropdown',
            options: AdminstrationOptions,
          },
        ],
      },
      {
        kind: 'field',
        field: {
          name: 'strength',
          placeholder: 'Strength',
          component: 'text',
        },
      },
      {
        kind: 'field',
        field: {
          name: 'unitofMeasure',
          placeholder: 'Strength unit',
          component: 'dropdown',
          options: UnitOptions,
        },
      },
      field('controlledSubstance', 'Controlled substance', 'checkbox'),
      field('prescriptionRequired', 'Prescription required', 'checkbox'),
      field('reportableToGovernment', 'Is it reportable to Government?', 'checkbox'),
    ],
    pricing: commonPricingFields,
    vendor: commonVendorFields(true),
    stock: commonStockFields(true),
    batch: commonBatchFields,
  },
  GROOMER: {
    basicInfo: [
      {
        kind: 'field',
        field: {
          name: 'name',
          placeholder: 'Item name',
          component: 'text',
        },
      },
      {
        kind: 'row',
        fields: [
          {
            name: 'category',
            placeholder: 'Category',
            component: 'dropdown',
            options: CategoryOptionsByBusiness.GROOMER,
          },
          {
            name: 'subCategory',
            placeholder: 'Sub category',
            component: 'dropdown',
            options: SubCategoryOptions,
          },
        ],
      },
      {
        kind: 'field',
        field: {
          name: 'department',
          placeholder: 'Department',
          component: 'dropdown',
          options: DepartmentOptions,
        },
      },
      {
        kind: 'row',
        fields: [
          {
            name: 'productUsage',
            placeholder: 'Product use',
            component: 'dropdown',
            options: IntendedUsageOptions.GROOMER,
          },
          {
            name: 'coatType',
            placeholder: 'Coat type',
            component: 'dropdown',
            options: CoatTypeOptions,
          },
        ],
      },
      {
        kind: 'row',
        fields: [
          {
            name: 'fragranceType',
            placeholder: 'Fragrance type',
            component: 'dropdown',
            options: FragranceTypeOptions,
          },
          {
            name: 'allergenFree',
            placeholder: 'Allergen free',
            component: 'dropdown',
            options: AllergenFreeOptions,
          },
        ],
      },
      {
        kind: 'field',
        field: {
          name: 'petSize',
          placeholder: 'Companion size',
          component: 'dropdown',
          options: PetSizeOptions,
        },
      },
      {
        kind: 'field',
        field: {
          name: 'description',
          placeholder: 'Description',
          component: 'textarea',
        },
      },
    ],
    classification: [
      {
        kind: 'field',
        field: {
          name: 'form',
          placeholder: 'Form / Presentation',
          component: 'dropdown',
          options: FormOptions,
        },
      },
      {
        kind: 'row',
        fields: [
          {
            name: 'species',
            placeholder: 'Species',
            component: 'multiSelect',
            options: SpeciesOptions,
          },
          {
            name: 'administration',
            placeholder: 'Administration',
            component: 'dropdown',
            options: AdminstrationOptions,
          },
        ],
      },
      {
        kind: 'field',
        field: {
          name: 'unitofMeasure',
          placeholder: 'Unit of Measure (Base)',
          component: 'dropdown',
          options: UnitOptions,
        },
      },
      {
        kind: 'field',
        field: {
          name: 'dispenseUnit',
          placeholder: 'Dispense unit',
          component: 'dropdown',
          options: DispenseUnitOptions,
        },
      },
      {
        kind: 'field',
        field: {
          name: 'packSize',
          placeholder: 'Pack size / Quantity per pack',
          component: 'text',
        },
      },
      {
        kind: 'field',
        field: {
          name: 'usagePerService',
          placeholder: 'Usage per service',
          component: 'text',
        },
      },
    ],
    pricing: commonPricingFields,
    vendor: commonVendorFields(false),
    stock: commonStockFields(false),
    batch: commonBatchFields,
  },
  BREEDER: {
    basicInfo: [
      {
        kind: 'field',
        field: {
          name: 'name',
          placeholder: 'Item name',
          component: 'text',
        },
      },
      {
        kind: 'row',
        fields: [
          {
            name: 'category',
            placeholder: 'Category',
            component: 'dropdown',
            options: CategoryOptionsByBusiness.BOARDER,
          },
          {
            name: 'subCategory',
            placeholder: 'Sub category',
            component: 'dropdown',
            options: SubCategoryOptions,
          },
        ],
      },
      {
        kind: 'row',
        fields: [
          {
            name: 'itemType',
            placeholder: 'Item type',
            component: 'dropdown',
            options: ItemTypeOptions,
          },
          {
            name: 'department',
            placeholder: 'Department',
            component: 'dropdown',
            options: DepartmentOptions,
          },
        ],
      },
      {
        kind: 'row',
        fields: [
          {
            name: 'productUsage',
            placeholder: 'Intended use',
            component: 'dropdown',
            options: IntendedUsageOptions.BOARDER,
          },
          {
            name: 'animalStage',
            placeholder: 'Animal stage',
            component: 'dropdown',
            options: AnimalStageOptions,
          },
        ],
      },
      {
        kind: 'field',
        field: {
          name: 'description',
          placeholder: 'Description',
          component: 'textarea',
        },
      },
    ],
    classification: [
      {
        kind: 'field',
        field: {
          name: 'breedingUse',
          placeholder: 'Breeding use',
          component: 'dropdown',
          options: BreedingUseOptions,
        },
      },
      {
        kind: 'row',
        fields: [
          {
            name: 'form',
            placeholder: 'Form / Presentation',
            component: 'dropdown',
            options: FormOptions,
          },
          {
            name: 'unitofMeasure',
            placeholder: 'Unit of Measure (Base)',
            component: 'dropdown',
            options: UnitOptions,
          },
        ],
      },
      {
        kind: 'field',
        field: {
          name: 'strength',
          placeholder: 'Strength',
          component: 'text',
        },
      },
      {
        kind: 'field',
        field: {
          name: 'packSize',
          placeholder: 'Pack size / Quantity per pack',
          component: 'text',
        },
      },
      {
        kind: 'field',
        field: {
          name: 'temperatureCondition',
          placeholder: 'Temperature condition',
          component: 'dropdown',
          options: TemperatureConditionOptions,
        },
      },
      {
        kind: 'row',
        fields: [
          {
            name: 'species',
            placeholder: 'Species',
            component: 'multiSelect',
            options: SpeciesOptions,
          },
          {
            name: 'usageType',
            placeholder: 'Usage type',
            component: 'dropdown',
            options: UsageTypeOptions,
          },
        ],
      },
      {
        kind: 'field',
        field: {
          name: 'litterGroup',
          placeholder: 'Litter group / Batch name',
          component: 'text',
        },
      },
      {
        kind: 'field',
        field: {
          name: 'shelfLife',
          placeholder: 'Shelf life (optional)',
          component: 'text',
        },
      },
      {
        kind: 'field',
        field: {
          name: 'heatCycle',
          placeholder: 'Heat cycle kit included',
          component: 'dropdown',
          options: HeatCycleOptions,
        },
      },
    ],
    pricing: commonPricingFields,
    vendor: [
      field('supplierName', 'Supplier name', 'text'),
      field('brand', 'Brand', 'text'),
      field('vendor', 'Vendor type', 'dropdown', VendorOptions),
      field('license', 'Supplier product code', 'text'),
      field('paymentTerms', 'Payment terms', 'dropdown', PaymentTermsOptions),
    ],
    stock: commonStockFields(false),
    batch: [
      field('batch', 'Batch / Lot Number', 'text'),
      row(f('quantity', 'Quantity', 'text'), f('allocated', 'Allocated', 'text')),
      field('litterId', 'Manufacture date', 'text'),
      field('manufactureDate', 'Associated litter ID', 'date'),
      field('expiryDate', 'Expiry date', 'date'),
      field('nextRefillDate', 'Next refill date', 'date'),
    ],
  },
  BOARDER: {
    basicInfo: [
      {
        kind: 'field',
        field: {
          name: 'name',
          placeholder: 'Item name',
          component: 'text',
        },
      },
      {
        kind: 'row',
        fields: [
          {
            name: 'category',
            placeholder: 'Category',
            component: 'dropdown',
            options: CategoryOptionsByBusiness.BREEDER,
          },
          {
            name: 'subCategory',
            placeholder: 'Sub category',
            component: 'dropdown',
            options: SubCategoryOptions,
          },
        ],
      },
      {
        kind: 'field',
        field: {
          name: 'department',
          placeholder: 'Department',
          component: 'dropdown',
          options: DepartmentOptions,
        },
      },
      {
        kind: 'field',
        field: {
          name: 'skuCode',
          placeholder: 'SKU / Code',
          component: 'text',
        },
      },
      {
        kind: 'field',
        field: {
          name: 'productUsage',
          placeholder: 'Usage location',
          component: 'dropdown',
          options: IntendedUsageOptions.BREEDER,
        },
      },
      {
        kind: 'field',
        field: {
          name: 'description',
          placeholder: 'Description',
          component: 'textarea',
        },
      },
    ],
    classification: [
      {
        kind: 'field',
        field: {
          name: 'intakeType',
          placeholder: 'Item type',
          component: 'dropdown',
          options: IntakeTypeOptions,
        },
      },
      {
        kind: 'field',
        field: {
          name: 'form',
          placeholder: 'Form / Presentation',
          component: 'dropdown',
          options: FormOptions,
        },
      },
      {
        kind: 'row',
        fields: [
          {
            name: 'species',
            placeholder: 'Species',
            component: 'multiSelect',
            options: SpeciesOptions,
          },
          {
            name: 'administration',
            placeholder: 'Administration',
            component: 'dropdown',
            options: AdminstrationOptions,
          },
        ],
      },
      {
        kind: 'field',
        field: {
          name: 'unitofMeasure',
          placeholder: 'Unit of Measure (Base)',
          component: 'dropdown',
          options: UnitOptions,
        },
      },
      {
        kind: 'field',
        field: {
          name: 'safetyClassification',
          placeholder: 'Safety classification',
          component: 'dropdown',
          options: SafetyClassificationOptions,
        },
      },
      {
        kind: 'field',
        field: {
          name: 'brand',
          placeholder: 'Brand',
          component: 'text',
        },
      },
      {
        kind: 'field',
        field: {
          name: 'shelfLife',
          placeholder: 'Shelf life (optional)',
          component: 'text',
        },
      },
    ],
    pricing: commonPricingFields,
    vendor: commonVendorFields(false),
    stock: commonStockFields(false),
    batch: commonBatchFields,
  },
};
