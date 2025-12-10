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
  FrequencyOptions,
  HeatCycleOptions,
  IntakeTypeOptions,
  IntendedUsageOptions,
  InventoryItem,
  InventoryTurnoverItem,
  ItemTypeOptions,
  PaymentTermsOptions,
  PetSizeOptions,
  PrescriptionRequiredOptions,
  RegulationTypeOptions,
  SafetyClassificationOptions,
  SpeciesOptions,
  StatusOptions,
  StockLocationOptions,
  StockTypeOptions,
  StorageConditionOptions,
  SubCategoryOptions,
  TemperatureConditionOptions,
  TherapeuticOptions,
  UnitOptions,
  UsageTypeOptions,
  VendorOptions,
} from "./types";
import { BusinessType } from "@/app/types/org";

export const DemoInventoryTurnover: InventoryTurnoverItem[] = [
  {
    name: "Paracetamol 500mg",
    category: "Medicine",
    beginningInventory: 200,
    endingInventory: 80,
    averageInventory: 140,
    totalPurchases: 300,
    turnsPerYear: 12,
    daysOnShelf: 30,
    status: "Excellent",
  },
  {
    name: "Surgical Gloves (Medium)",
    category: "Consumable",
    beginningInventory: 500,
    endingInventory: 300,
    averageInventory: 400,
    totalPurchases: 600,
    turnsPerYear: 8,
    daysOnShelf: 45,
    status: "Healthy",
  },
  {
    name: "Syringe 5ml",
    category: "Consumable",
    beginningInventory: 800,
    endingInventory: 600,
    averageInventory: 700,
    totalPurchases: 1000,
    turnsPerYear: 6,
    daysOnShelf: 60,
    status: "Moderate",
  },
  {
    name: "Blood Pressure Monitor",
    category: "Equipment",
    beginningInventory: 20,
    endingInventory: 15,
    averageInventory: 17.5,
    totalPurchases: 10,
    turnsPerYear: 2,
    daysOnShelf: 180,
    status: "Low",
  },
  {
    name: "Vitamin C Tablets",
    category: "Medicine",
    beginningInventory: 300,
    endingInventory: 120,
    averageInventory: 210,
    totalPurchases: 350,
    turnsPerYear: 10,
    daysOnShelf: 36,
    status: "Excellent",
  },
  {
    name: "Face Masks",
    category: "Consumable",
    beginningInventory: 1000,
    endingInventory: 200,
    averageInventory: 600,
    totalPurchases: 1500,
    turnsPerYear: 15,
    daysOnShelf: 24,
    status: "Excellent",
  },
  {
    name: "Wheelchair",
    category: "Equipment",
    beginningInventory: 12,
    endingInventory: 10,
    averageInventory: 11,
    totalPurchases: 5,
    turnsPerYear: 1,
    daysOnShelf: 365,
    status: "Low",
  },
  {
    name: "Amoxicillin 250mg",
    category: "Medicine",
    beginningInventory: 150,
    endingInventory: 40,
    averageInventory: 95,
    totalPurchases: 200,
    turnsPerYear: 11,
    daysOnShelf: 33,
    status: "Healthy",
  },
  {
    name: "Hand Sanitizer 500ml",
    category: "Consumable",
    beginningInventory: 300,
    endingInventory: 50,
    averageInventory: 175,
    totalPurchases: 400,
    turnsPerYear: 14,
    daysOnShelf: 26,
    status: "Excellent",
  },
  {
    name: "Nebulizer Machine",
    category: "Equipment",
    beginningInventory: 10,
    endingInventory: 0,
    averageInventory: 5,
    totalPurchases: 8,
    turnsPerYear: 3,
    daysOnShelf: 120,
    status: "Out of stock",
  },
];

const secureRandom = (): number => {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 2 ** 32;
  }
  return Math.random(); // NOSONAR
};

const pick = <T>(arr: T[]): T => arr[Math.floor(secureRandom() * arr.length)];

const randomDate = () => {
  const start = new Date(2021, 0, 1).getTime();
  const end = new Date(2025, 11, 31).getTime();
  return new Date(start + secureRandom() * (end - start))
    .toISOString()
    .split("T")[0];
};

const rand = (prefix: string) =>
  `${prefix}-${Math.floor(secureRandom() * 9999)}`;

export function generateDummyInventoryItem(
  business: BusinessType
): InventoryItem {
  return {
    basicInfo: {
      name: rand("Item"),
      category: pick(CategoryOptionsByBusiness[business]),
      subCategory: pick(SubCategoryOptions),
      department: pick(DepartmentOptions),
      description: "Dummy description here...",
      status: pick(StatusOptions),

      itemType: pick(ItemTypeOptions),
      prescriptionRequired: pick(PrescriptionRequiredOptions),
      regulationType: pick(RegulationTypeOptions),
      storageCondition: pick(StorageConditionOptions),

      productUsage: rand("Usage"),
      intendedUsage: pick([
        ...IntendedUsageOptions.GROOMER,
        ...IntendedUsageOptions.BOARDER,
        ...IntendedUsageOptions.BREEDER,
      ]),
      coatType: pick(CoatTypeOptions),
      fragranceType: pick(FragranceTypeOptions),
      allergenFree: pick(AllergenFreeOptions),
      petSize: pick(PetSizeOptions),
      animalStage: pick(AnimalStageOptions),
      skuCode: rand("SKU"),
    },
    classification: {
      form: pick(FormOptions),
      unitofMeasure: pick(UnitOptions),
      species: pick(SpeciesOptions),
      administration: pick(AdminstrationOptions),

      therapeuticClass: pick(TherapeuticOptions),
      strength: `${Math.floor(secureRandom() * 500)}mg`,
      dosageForm: pick(FormOptions),
      withdrawlPeriod: `${Math.floor(secureRandom() * 12)} days`,

      dispenseUnit: pick(DispenseUnitOptions),
      packSize: `${Math.floor(secureRandom() * 10) + 1}`,
      usagePerService: `${Math.floor(secureRandom() * 50)}ml`,

      breedingUse: pick(BreedingUseOptions),
      temperatureCondition: pick(TemperatureConditionOptions),
      usageType: pick(UsageTypeOptions),
      litterGroup: rand("Group"),
      shelfLife: `${Math.floor(secureRandom() * 36)} months`,
      heatCycle: pick(HeatCycleOptions),

      intakeType: pick(IntakeTypeOptions),
      frequency: pick(FrequencyOptions),
      productUse: pick([
        ...IntendedUsageOptions.GROOMER,
        ...IntendedUsageOptions.BOARDER,
        ...IntendedUsageOptions.BREEDER,
      ]),
      safetyClassification: pick(SafetyClassificationOptions),
      brand: rand("Brand"),
    },
    pricing: {
      purchaseCost: `${Math.floor(secureRandom() * 300)}`,
      selling: `${Math.floor(secureRandom() * 800)}`,
      maxDiscount: `${Math.floor(secureRandom() * 30)}`,
      tax: `${Math.floor(secureRandom() * 18)}`,
    },
    vendor: {
      supplierName: rand("Supplier"),
      brand: rand("Brand"),
      vendor: pick(VendorOptions),
      license: rand("LIC"),
      paymentTerms: pick(PaymentTermsOptions),
      leadTime: `${Math.floor(secureRandom() * 10)}`,
    },
    stock: {
      current: `${Math.floor(secureRandom() * 100)}`,
      allocated: `${Math.floor(secureRandom() * 30)}`,
      available: `${Math.floor(secureRandom() * 70)}`,
      reorderLevel: `${Math.floor(secureRandom() * 15)}`,
      reorderQuantity: `${Math.floor(secureRandom() * 50)}`,
      stockLocation: pick(StockLocationOptions),
      stockType: pick(StockTypeOptions),
      minStockAlert: `${Math.floor(secureRandom() * 10)}`,
    },
    batch: {
      batch: rand("BATCH"),
      manufactureDate: randomDate(),
      expiryDate: randomDate(),
      nextRefillDate: randomDate(),
      serial: rand("SER"),
      tracking: rand("TRACK"),
      litterId: rand("LITTER"),
    },
  };
}

export function generateDummyInventoryList(
  business: BusinessType,
  count: number = 10
): InventoryItem[] {
  return Array.from({ length: count }, () =>
    generateDummyInventoryItem(business)
  );
}

export const InventoryData = generateDummyInventoryList("HOSPITAL", 10);
