import { BusinessType } from "@/app/types/org";

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
  ],
};
export const SubCategoryOptions: string[] = [
  "Antibiotic",
  "Anti-inflammatory",
  "Dewormer",
  "Painkiller",
  "Antifungal",
  "Antiviral",
  "Bandage",
  "Gloves",
  "IV Line",
  "Syringe",
  "Vitamin",
  "Probiotic",
  "Mineral Mix",
];
export const DepartmentOptions: string[] = [
  "Veterinary",
  "Grooming",
  "Breeding",
  "Boarding",
];
export const IntendedUsageOptions: Record<BusinessType, string[]> = {
  HOSPITAL: [],
  GROOMER: ["Bathing", "Styling", "Cleaning", "Disinfection", "Finishing"],
  BOARDER: ["Kennel", "Play area", "Feeding zone", "Reception", "Laundry"],
  BREEDER: ["Feeding", "Fertility Care", "Cleaning", "Nursing Support"],
};

// Hospital
export const ItemTypeOptions: string[] = ["Drug", "No-drug"];
export const PrescriptionRequiredOptions: string[] = ["Yes", "No"];
export const RegulationTypeOptions: string[] = ["Controlled", "Non-controlled"];
export const StorageConditionOptions: string[] = [
  "Room temp",
  "Refrigerated",
  "Freezer",
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
];
// Hospital
export const TherapeuticOptions = [
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
];
// Groomer
export const DispenseUnitOptions: string[] = [
  "Pack",
  "Vial",
  "Bottle",
  "Syringe",
  "Tub",
  "Sachet",
];
//Breeder
export const BreedingUseOptions = [
  "Nutrition",
  "Whelping",
  "Fertility",
  "Postnatal",
  "Heat monitoring",
  "Cleaning",
];
export const TemperatureConditionOptions: string[] = [
  "Room Temperature",
  "Refrigerated",
  "Controlled Environment",
];
export const UsageTypeOptions: string[] = ["Internal", "External"];
export const HeatCycleOptions: string[] = ["Yes", "No"];
// Boarder
export const IntakeTypeOptions: string[] = ["Consumable", "Non-consumable"];
export const FrequencyOptions: string[] = ["Daily", "Weekly", "Occasionally"];
export const ProductUse: string[] = [
  "Cleaning",
  "Feeding",
  "Bedding",
  "Play",
  "Laundry",
  "Health",
];
export const SafetyClassificationOptions: string[] = [
  "Non-hazardous",
  "Flammable",
  "Chemical",
  "Fragile",
];

export type ClassificationValues = {
  form: string;
  unitofMeasure: string;
  species: string;
  administration: string;

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
];
export const PaymentTermsOptions = ["Net 30", "Net 15", "COD"];

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
];
export const StockTypeOptions = ["Central store", "Pharmacy", "Surgery", "Lab"];

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

  // Hospital
  serial?: string;
  tracking?: string;

  // Breeder
  litterId?: string;
};

export interface InventoryItem {
  basicInfo: BasicInfoValues;
  classification: ClassificationValues;
  pricing: PricingValues;
  vendor: VendorValues;
  stock: StockValues;
  batch: BatchValues;
}

export type InventoryErrors = {
  basicInfo?: Partial<Record<keyof BasicInfoValues, string>>;
  classification?: Partial<Record<keyof ClassificationValues, string>>;
  pricing?: Partial<Record<keyof PricingValues, string>>;
  vendor?: Partial<Record<keyof VendorValues, string>>;
  stock?: Partial<Record<keyof StockValues, string>>;
  batch?: Partial<Record<keyof BatchValues, string>>;
};

export interface InventoryTurnoverItem {
  name: string;
  category: "Medicine" | "Consumable" | "Equipment";
  beginningInventory: number;
  endingInventory: number;
  averageInventory: number;
  totalPurchases: number;
  turnsPerYear: number;
  daysOnShelf: number;
  status: "Excellent" | "Healthy" | "Moderate" | "Low" | "Out of stock";
}
