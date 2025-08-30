import { z } from 'zod';

export const inventorySchema = z.object({
  barCode: z.string({ required_error: "Barcode is required" }).nonempty("Barcode is required"),
  category: z.string({ required_error: "Category is required" }).nonempty("Category is required"),
  itemName: z.string({ required_error: "Item name is required" }).nonempty("Item name is required"),
  genericName: z.string().optional(),
  department: z.string({ required_error: "Department is required" }).nonempty("Department is required"),
  sexType: z.string().optional(),
  manufacturer: z.string({ required_error: "Manufacturer is required" }).nonempty("Manufacturer is required"),
  itemCategory: z.string({ required_error: "Item category is required" }).nonempty("Item category is required"),
  speciesSpecific1: z.string().optional(),
  speciesSpecific2: z.string().optional(),
  onHand: z.string().optional(),
  perQtyPrice: z.number({ invalid_type_error: "Per Qty Price must be a number" }).nonnegative().optional(),
  batchNumber: z.string().optional(),
  sku: z.string({ required_error: "SKU is required" }).nonempty("SKU is required"),
  strength: z.string().optional(),
  quantity: z.number({ invalid_type_error: "Quantity is required" }).int().nonnegative({ message: "Quantity must be a positive number" }),
  manufacturerPrice: z.number({ invalid_type_error: "Manufacturer Price must be a number" }).nonnegative().optional(),
  markup: z.number({ invalid_type_error: "Markup must be a number" }).nonnegative().optional(),
  upc: z.string().optional(),
  price: z.number({ required_error: "Price is required", invalid_type_error: "Price must be a number" }).nonnegative({ message: "Price must be positive" }),
  stockReorderLevel: z.number().int().nonnegative().optional(),
  expiryDate: z.string({ required_error: "Expiry date is required" }).refine(
    val => !isNaN(Date.parse(val)),
    { message: "Invalid expiry date format" }
  ),
});

export const validateInventoryData = (data: any): string | null => {
  const regexRules = {
    barCode: /^[0-9]{6,20}$/, // numeric, 6-20 digits
    category: /^[A-Za-z0-9\s]{2,100}$/, // alphanum
    itemName: /^[A-Za-z0-9\s]{2,100}$/, // alphanum + space
    genericName: /^[A-Za-z\s]{2,100}$/,
    department: /^[A-Za-z\s]{2,50}$/,
    sexType: /^(Male|Female|Unisex)$/,
    manufacturer: /^[A-Za-z\s]{2,100}$/,
    itemCategory: /^[A-Za-z\s]{2,100}$/,
    speciesSpecific1: /^[A-Za-z\s]{2,50}$/,
    speciesSpecific2: /^[A-Za-z\s]{2,50}$/,
    onHand: /^(Yes|No)$/,
    batchNumber: /^[A-Za-z0-9\-]{2,20}$/,
    sku: /^[A-Z0-9\-]{5,30}$/,
    strength: /^[0-9]{1,4}(mg|g|ml)$/,
    upc: /^[0-9]{12}$/, // standard 12-digit UPC
    expiryDate: /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
  };

  type RegexField = keyof typeof regexRules;
  for (const field of Object.keys(regexRules) as RegexField[]) {
    if (data[field] && !regexRules[field].test(data[field])) {
      return `Invalid ${field} format.`;
    }
  }

  // Additional type & range checks
  if (typeof data.perQtyPrice !== 'number' || data.perQtyPrice < 0)
    return 'perQtyPrice must be a positive number.';
  if (typeof data.quantity !== 'number' || data.quantity < 0)
    return 'quantity must be a positive number.';
  if (typeof data.manufacturerPrice !== 'number' || data.manufacturerPrice < 0)
    return 'manufacturerPrice must be a positive number.';
  if (typeof data.markup !== 'number' || data.markup < 0)
    return 'markup must be a positive number.';
  if (typeof data.price !== 'number' || data.price < 0)
    return 'price must be a positive number.';
  if (typeof data.stockReorderLevel !== 'number' || data.stockReorderLevel < 0)
    return 'stockReorderLevel must be a positive number.';

  return null;
};

// Optional: export the type too
export type InventoryValidationInput = z.infer<typeof inventorySchema>;
