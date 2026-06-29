export type InventoryCategorySeed = {
  name: string;
  code: string;
  isMedical: boolean;
  sortOrder: number;
  subcategories: string[];
};

const slugify = (value: string) => {
  const lower = value.toLowerCase().trim();
  let slug = "";
  let pendingDash = false;

  for (const char of lower) {
    const isAlphaNumeric =
      (char >= "a" && char <= "z") || (char >= "0" && char <= "9");

    if (isAlphaNumeric) {
      if (pendingDash && slug.length > 0) {
        slug += "-";
      }
      slug += char;
      pendingDash = false;
      continue;
    }

    pendingDash = true;
  }

  return slug;
};

const category = (
  name: string,
  subcategories: string[],
  isMedical = false,
  sortOrder = 0,
): InventoryCategorySeed => ({
  name,
  code: slugify(name),
  isMedical,
  sortOrder,
  subcategories,
});

export const INVENTORY_CATEGORY_SEED: InventoryCategorySeed[] = [
  category(
    "Medicine",
    [
      "Antibiotic",
      "NSAID",
      "Analgesic",
      "Antifungal",
      "Antiviral",
      "Sedative",
      "Anesthetic",
      "Cardiac",
      "Dermatology",
      "Ophthalmic",
      "Otic",
    ],
    true,
    10,
  ),
  category(
    "Vaccine",
    [
      "Core vaccine",
      "Non-core vaccine",
      "Rabies",
      "DHPP",
      "FVRCP",
      "Bordetella",
      "Leptospirosis",
    ],
    true,
    20,
  ),
  category(
    "Consumable",
    [
      "Syringe",
      "Needle",
      "IV catheter",
      "Gloves",
      "Mask",
      "Gauze",
      "Cotton",
      "Bandage",
    ],
    false,
    30,
  ),
  category(
    "Surgical supply",
    [
      "Suture",
      "Scalpel blade",
      "Surgical drape",
      "Surgical glove",
      "Surgical pack",
    ],
    false,
    40,
  ),
  category(
    "IV / Fluid therapy",
    ["Fluid bag", "IV line", "Giving set", "Extension set", "Flush"],
    false,
    50,
  ),
  category(
    "Diagnostic kit",
    ["Rapid test", "Lateral flow", "Point of care"],
    true,
    60,
  ),
  category(
    "Laboratory",
    ["Sample tube", "Slide", "Swab", "Reagent", "Collection container"],
    true,
    70,
  ),
  category(
    "Food",
    ["Prescription diet", "Maintenance diet", "Treat"],
    false,
    80,
  ),
  category(
    "Supplement",
    ["Vitamin", "Mineral", "Probiotic", "Omega"],
    false,
    90,
  ),
  category(
    "Equipment",
    [
      "Reusable instrument",
      "Monitoring equipment",
      "Imaging equipment",
      "Dental equipment",
    ],
    false,
    100,
  ),
  category(
    "Cleaning supply",
    ["Disinfectant", "Detergent", "Surface cleaner", "Laundry cleaner"],
    false,
    110,
  ),
  category(
    "Imaging consumable",
    ["Contrast media", "X-ray consumable", "Ultrasound consumable"],
    false,
    120,
  ),
  category(
    "Wound care",
    ["Dressing", "Bandage", "Gauze", "Topical cream"],
    false,
    130,
  ),
];

const CATEGORY_LOOKUP = new Map(
  INVENTORY_CATEGORY_SEED.map((entry) => [entry.name.toLowerCase(), entry]),
);

export type InventoryStockStatus =
  | "In stock"
  | "Low stock"
  | "Out of stock"
  | "Expiring soon"
  | "Expired"
  | "Inactive";

export type PricingMetrics = {
  grossProfit: number;
  marginPercentage: number | null;
};

export function normalizeInventoryCategoryName(value: string) {
  return value.trim();
}

export function getInventoryCategories() {
  return INVENTORY_CATEGORY_SEED.map((entry) => ({
    name: entry.name,
    code: entry.code,
    isMedical: entry.isMedical,
    sortOrder: entry.sortOrder,
    subcategories: entry.subcategories.map((subcategory, index) => ({
      name: subcategory,
      code: slugify(subcategory),
      sortOrder: index + 1,
      isActive: true,
    })),
  }));
}

export function getInventoryCategorySeed(categoryName: string) {
  return CATEGORY_LOOKUP.get(categoryName.trim().toLowerCase()) ?? null;
}

export function getInventorySubcategories(categoryName: string) {
  return getInventoryCategorySeed(categoryName)?.subcategories ?? [];
}

export function isMedicalInventoryCategory(categoryName: string) {
  return getInventoryCategorySeed(categoryName)?.isMedical ?? false;
}

export function validateInventoryCategorySelection(
  categoryName: string,
  subcategoryName?: string | null,
) {
  const category = getInventoryCategorySeed(categoryName);
  if (!category) {
    return { categoryExists: false, subcategoryValid: true };
  }

  if (!subcategoryName) {
    return { categoryExists: true, subcategoryValid: true };
  }

  return {
    categoryExists: true,
    subcategoryValid: category.subcategories.some(
      (subcategory) =>
        subcategory.toLowerCase() === subcategoryName.trim().toLowerCase(),
    ),
  };
}

export function calculateInventoryStockStatus(args: {
  active: boolean;
  currentStock: number;
  minimumStock?: number | null;
  expiryDate?: Date | string | null;
  expiringSoonDays?: number;
}) {
  const {
    active,
    currentStock,
    minimumStock,
    expiryDate,
    expiringSoonDays = 30,
  } = args;

  if (!active) {
    return "Inactive" as const;
  }
  if (currentStock <= 0) {
    return "Out of stock" as const;
  }

  const normalizedExpiry =
    expiryDate instanceof Date
      ? expiryDate
      : expiryDate
        ? new Date(expiryDate)
        : null;
  if (normalizedExpiry && !Number.isNaN(normalizedExpiry.getTime())) {
    const now = new Date();
    const daysUntilExpiry = Math.ceil(
      (normalizedExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysUntilExpiry < 0) {
      return "Expired" as const;
    }
    if (daysUntilExpiry <= expiringSoonDays) {
      return "Expiring soon" as const;
    }
  }

  if (minimumStock != null && currentStock <= minimumStock) {
    return "Low stock" as const;
  }

  return "In stock" as const;
}

export function calculatePricingMetrics(args: {
  sellingPrice?: number | null;
  costPrice?: number | null;
}): PricingMetrics {
  const sellingPrice = args.sellingPrice ?? 0;
  const costPrice = args.costPrice ?? 0;
  const grossProfit = sellingPrice - costPrice;
  if (sellingPrice <= 0) {
    return { grossProfit, marginPercentage: null };
  }
  return {
    grossProfit,
    marginPercentage: (grossProfit / sellingPrice) * 100,
  };
}
