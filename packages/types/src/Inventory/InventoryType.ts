import { Types } from "mongoose";

export type InventoryType = {
  businessId?: string;
  barCode: string;
  category: string | Types.ObjectId;
  itemName: string;
  genericName?: string;
  department: string;
  sexType?: string;
  manufacturer: string;
  itemCategory: string;
  speciesSpecific1?: string;
  speciesSpecific2?: string;
  onHand: string;
  perQtyPrice: number;
  batchNumber?: string;
  sku?: string;
  strength?: string;
  quantity: number;
  manufacturerPrice: number;
  markup: number;
  upc?: string;
  price: number;
  stockReorderLevel: number;
  expiryDate: string; // ISO 8601 format
};
