import { BusinessType } from "@/app/types/org";

export type InventoryStatus = "ACTIVE" | "HIDDEN";

export type StockHealthStatus =
  | "HEALTHY"
  | "LOW_STOCK"
  | "EXPIRED"
  | "EXPIRING_SOON"
  | string;

export type InventoryBatchApi = {
  batchNumber?: string;
  lotNumber?: string;
  regulatoryTrackingId?: string;
  manufactureDate?: string;
  expiryDate?: string;
  minShelfLifeAlertDate?: string;
  quantity?: number;
  allocated?: number;
  createdAt?: string;
  updatedAt?: string;
  _id?: string;
  itemId?: string;
  organisationId?: string;
};

export type InventoryApiItem = {
  _id: string;
  organisationId: string;
  businessType: BusinessType;
  name: string;
  sku?: string;
  category?: string;
  subCategory?: string;
  description?: string;
  imageUrl?: string;
  attributes?: Record<string, any>;
  onHand?: number;
  allocated?: number;
  reorderLevel?: number;
  unitCost?: number;
  sellingPrice?: number;
  currency?: string;
  vendorId?: string;
  status?: string;
  stockHealth?: StockHealthStatus;
  batches?: InventoryBatchApi[];
  createdAt?: string;
  updatedAt?: string;
};

export type InventoryBatchPayload = {
  _id?: string;
  itemId?: string;
  organisationId?: string;
  batchNumber?: string;
  lotNumber?: string;
  regulatoryTrackingId?: string;
  manufactureDate?: string;
  expiryDate?: string;
  minShelfLifeAlertDate?: string;
  quantity?: number;
  allocated?: number;
};

export type InventoryRequestPayload = {
  organisationId: string;
  businessType: BusinessType;
  name: string;
  sku?: string;
  category?: string;
  subCategory?: string;
  description?: string;
  imageUrl?: string;
  attributes?: Record<string, any>;
  onHand?: number;
  allocated?: number;
  reorderLevel?: number;
  unitCost?: number;
  sellingPrice?: number;
  currency?: string;
  vendorId?: string;
  status?: string;
  batches?: InventoryBatchPayload[];
};

// Primary Information Values
export const StatusOptions: string[] = [
  "Low stock",
  "Expired",
  "Hidden",
  "This week",
];
export const CategoryOptionsByBusiness: Record<BusinessType, string[]> = {
  HOSPITAL: [
    "Medicine",
    "Consumable",
    "Equipment",
    "Supplement",
    "Diagnostic kit",
    "Vaccine",
    "Food",
    "Cleaning supply",
    "Surgical supply",
    "Wound care",
    "IV/Fluid therapy",
    "Laboratory",
    "Imaging consumable",
  ],
  GROOMER: [
    "Accessories",
    "Shampoo",
    "Conditioner",
    "Brush",
    "Comb",
    "Clipper",
    "Blade",
    "Spray",
    "Towel",
    "Cleaning Supply",
    "Disinfectant",
    "Perfume",
    "Ear care",
    "Paw care",
    "Nail care",
    "Dental hygiene",
  ],
  BREEDER: [
    "Medicine",
    "Consumable",
    "Equipment",
    "Supplement",
    "Food",
    "Bedding",
    "Accessory",
    "Cleaning supply",
    "Fertility aid",
    "Neonatal care",
    "Vaccination kit",
  ],
  BOARDER: [
    "Bedding",
    "Pet food",
    "Toy",
    "Grooming essentials",
    "Laundry supplies",
    "Health & safety",
    "Maintenance",
    "Miscellaneous",
    "Cleaning supply",
    "Pest control",
    "Disinfection",
    "Facility supplies",
  ],
};
export const SubCategoryOptions: string[] = [
  "Accessories",
  "Antibiotic",
  "Anti-inflammatory",
  "Dewormer",
  "Painkiller",
  "Antifungal",
  "Antiviral",
  "Bandage",
  "IV Line",
  "Syringe",
  "Vitamin",
  "Probiotic",
  "Mineral Mix",
  "Bandage roll",
  "Sutures",
  "Cannula",
  "Catheter",
  "Fluid set",
  "Scalpel",
  "Mask & gloves",
  "Disinfectant wipes",
  "Sterilization pouch",
  "Ophthalmic",
  "Otic",
  "Dermatology",
  "Pain management",
  "Dental care",
  "Nutritional",
  "Orthopedic support",
];
export const DepartmentOptions: string[] = [
  "Veterinary",
  "Grooming",
  "Breeding",
  "Boarding",
  "Surgery",
  "Pharmacy",
  "ICU/Ward",
  "Diagnostics",
];
export const IntendedUsageOptions: Record<BusinessType, string[]> = {
  HOSPITAL: [
    "Outpatient",
    "Inpatient",
    "Surgery",
    "Diagnostics",
    "Emergency/ICU",
    "Vaccination drive",
  ],
  GROOMER: [
    "Bathing",
    "Styling",
    "Cleaning",
    "Disinfection",
    "Finishing",
    "Flea & tick treatment",
    "De-shedding",
  ],
  BOARDER: [
    "Kennel",
    "Play area",
    "Feeding zone",
    "Reception",
    "Laundry",
    "Isolation/Quarantine",
    "Deep clean",
  ],
  BREEDER: [
    "Feeding",
    "Fertility Care",
    "Cleaning",
    "Nursing Support",
    "Vaccination schedule",
    "Weaning",
  ],
};

// Hospital
export const ItemTypeOptions: string[] = ["Drug", "No-drug"];
export const PrescriptionRequiredOptions: string[] = ["Yes", "No"];
export const RegulationTypeOptions: string[] = ["Controlled", "Non-controlled"];
export const StorageConditionOptions: string[] = [
  "Room temp",
  "Refrigerated",
  "Freezer",
  "Cold chain (2-8°C)",
  "Frozen (-20°C)",
  "Deep frozen (-80°C)",
  "Light protected",
];
// Groomer
export const CoatTypeOptions: string[] = [
  "Short",
  "Long",
  "Curly",
  "Double",
  "Wire",
];
export const FragranceTypeOptions: string[] = [
  "Floral",
  "Fruity",
  "Fresh",
  "Medicinal",
  "Unscented",
];
export const AllergenFreeOptions: string[] = ["Yes", "No"];
export const PetSizeOptions: string[] = [
  "Small (0 - 10 Ibs)",
  "Medium (10 - 25 Ibs)",
  "Large (25 - 45 Ibs)",
  "Giant (45 Ibs+)",
];
// Breeder
export const AnimalStageOptions: string[] = [
  "Puppy",
  "Adult",
  "Pregnant",
  "Nursing",
  "Stud",
  "Senior",
  "Neonate",
];

export type BasicInfoValues = {
  name: string;
  category: string;
  subCategory: string;
  department: string;
  description: string;
  status: string;

  // Hospital
  itemType?: string;
  prescriptionRequired?: string;
  regulationType?: string;
  storageCondition?: string;

  // Groomer
  productUsage?: string;
  intendedUsage?: string;
  coatType?: string;
  fragranceType?: string;
  allergenFree?: string;
  petSize?: string;

  // Breeder
  // Item type - defined above in hospital
  // Intended Usage - defined above in groomer
  animalStage?: string;

  // Boarder
  // Intended Usage - defined above in groomer
  skuCode?: string;
};

// Classification Values
export const FormOptions = [
  "Tablet",
  "Capsule",
  "Ointment",
  "Powder",
  "Liquid",
  "Solution",
  "Spray",
  "Wipe",
  "Treat",
  "Food pack",
  "Other"
];
export const UnitOptions = [
  "tablets",
  "ml",
  "gms",
  "kg",
  "piece",
  "pack",
  "litre",
  "bag",
  "roll",
  "box",
  "pair",
  "sheet",
  "cartridge",
  "can",
  "jar",
];
export const SpeciesOptions = ["Dog", "Cat", "Horse"];
export const AdminstrationOptions = [
  "Oral",
  "Topical",
  "Injectable",
  "Rectal",
  "Ophthalmic",
  "Inhalation",
  "Otic",
  "Sublingual",
  "Buccal",
  "Intranasal",
  "IV",
  "IM",
  "SC",
];
// Hospital
export const TherapeuticOptions = [
  "Accessories",
  "Antibiotic",
  "Analgesic",
  "Antifungal",
  "Anthelmintic",
  "Antiseptic",
  "Sedative",
  "NSAID",
  "Antiparasitic",
  "Vaccine",
  "Supplement",
  "Anesthetic",
  "Cardiac",
  "Endocrine",
  "Gastrointestinal",
  "Dermatology",
  "Ophthalmic care",
  "Otic care",
  "Fluid therapy",
  "Orthopedic",
];
// Groomer
export const DispenseUnitOptions: string[] = [
  "Pack",
  "Vial",
  "Bottle",
  "Syringe",
  "Tub",
  "Sachet",
  "Pouch",
  "Cartridge",
  "Jar",
];
//Breeder
export const BreedingUseOptions = [
  "Nutrition",
  "Whelping",
  "Fertility",
  "Postnatal",
  "Heat monitoring",
  "Cleaning",
  "Supplementation",
  "Vaccination",
];
export const TemperatureConditionOptions: string[] = [
  "Room Temperature",
  "Refrigerated",
  "Controlled Environment",
  "Cold chain (2-8°C)",
  "Frozen (-20°C)",
];
export const UsageTypeOptions: string[] = ["Internal", "External", "Topical", "Injectable"];
export const HeatCycleOptions: string[] = ["Yes", "No"];
// Boarder
export const IntakeTypeOptions: string[] = ["Consumable", "Non-consumable", "Asset/Equipment"];
export const FrequencyOptions: string[] = ["Daily", "Weekly", "Occasionally", "Monthly"];
export const ProductUse: string[] = [
  "Cleaning",
  "Feeding",
  "Bedding",
  "Play",
  "Laundry",
  "Health",
  "Pest control",
  "Disinfection",
  "Enrichment",
];
export const SafetyClassificationOptions: string[] = [
  "Non-hazardous",
  "Flammable",
  "Chemical",
  "Fragile",
  "Corrosive",
  "Biohazard",
];

export type ClassificationValues = {
  form?: string;
  unitofMeasure?: string | string[];
  species?: string | string[];
  administration?: string;

  // Hospital
  therapeuticClass?: string;
  strength?: string;
  dosageForm?: string;
  withdrawlPeriod?: string;

  // Groomer
  dispenseUnit?: string;
  packSize?: string;
  usagePerService?: string;

  // Breeder
  // Pack Size - defined above in groomer
  // Strength - defined above in hospital
  breedingUse?: string;
  temperatureCondition?: string;
  usageType?: string;
  litterGroup?: string;
  shelfLife?: string;
  heatCycle?: string;

  // Boarder
  intakeType?: string;
  frequency?: string;
  productUse?: string;
  safetyClassification?: string;
  brand?: string;
};

// Pricing Values
export type PricingValues = {
  purchaseCost?: string;
  selling?: string;
  maxDiscount?: string;
  tax?: string;
};

// Vendor Values
export const VendorOptions = [
  "Distributor",
  "Wholesaler",
  "Manufacturer",
  "Retailer",
  "Importer",
  "Local supplier",
];
export const PaymentTermsOptions = ["Net 30", "Net 15", "Net 45", "COD", "Advance"];

export type VendorValues = {
  supplierName: string;
  brand: string;
  vendor: string;
  license: string;
  paymentTerms: string;

  // Hospital
  leadTime?: string;
};

// Stock Values
export const StockLocationOptions = [
  "Pharmacy",
  "Grooming room",
  "Surgery",
  "Boarding storage",
  "Breeding unit",
  "Warehouse",
  "Receiving",
  "Treatment room",
  "Isolation ward",
];
export const StockTypeOptions = ["Central store", "Pharmacy", "Surgery", "Lab", "Cold storage"];

export type StockValues = {
  current: string;
  allocated: string;
  available: string;
  reorderLevel: string;
  reorderQuantity: string;
  stockLocation: string;
  minStockAlert?: string;

  // Hospital
  stockType?: string;
};

// Batch Values
export type BatchValues = {
  batch: string;
  manufactureDate: string;
  expiryDate: string;
  nextRefillDate?: string;
  quantity?: string;
  allocated?: string;
  _id?: string;
  itemId?: string;
  organisationId?: string;
  minShelfLifeAlertDate?: string;
  createdAt?: string;
  updatedAt?: string;

  // Hospital
  serial?: string;
  tracking?: string;

  // Breeder
  litterId?: string;
};

export interface InventoryItem {
  id?: string;
  organisationId?: string;
  businessType?: BusinessType;
  stockHealth?: StockHealthStatus;
  status?: InventoryStatus | string;
  attributes?: Record<string, any>;
  sku?: string;
  imageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  batches?: BatchValues[];
  basicInfo: BasicInfoValues;
  classification: ClassificationValues;
  pricing: PricingValues;
  vendor: VendorValues;
  stock: StockValues;
  batch: BatchValues;
}

export type InventoryFiltersState = {
  category: string;
  status: string;
  search: string;
};

export type InventoryErrors = {
  basicInfo?: Partial<Record<keyof BasicInfoValues, string>>;
  classification?: Partial<Record<keyof ClassificationValues, string>>;
  pricing?: Partial<Record<keyof PricingValues, string>>;
  vendor?: Partial<Record<keyof VendorValues, string>>;
  stock?: Partial<Record<keyof StockValues, string>>;
  batch?: Partial<Record<keyof BatchValues, string>>;
};

export interface InventoryTurnoverItem {
  itemId?: string;
  name: string;
  category?: string;
  subCategory?: string;
  beginningInventory: number;
  endingInventory: number;
  averageInventory?: number;
  avgInventory?: number;
  totalPurchases?: number;
  totalPurchased?: number;
  turnsPerYear: number;
  daysOnShelf: number;
  status?: "Excellent" | "Healthy" | "Moderate" | "Low" | "Out of stock" | string;
}
