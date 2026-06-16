/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  InventoryBusinessType,
  InventoryItem as PrismaInventoryItem,
  InventoryBatch as PrismaInventoryBatch,
  InventoryVendor as PrismaInventoryVendor,
  InventoryMetaField as PrismaInventoryMetaField,
  InventoryStockMovement as PrismaInventoryStockMovement,
  InventoryCategory as PrismaInventoryCategory,
  InventorySubcategory as PrismaInventorySubcategory,
} from "@prisma/client";

export type BusinessType = InventoryBusinessType;
export type InventoryItemType = "MEDICAL" | "NON_MEDICAL";

export type InventoryItemMongo = PrismaInventoryItem;
export type InventoryBatchMongo = PrismaInventoryBatch;
export type InventoryVendorMongo = PrismaInventoryVendor;
export type InventoryCategoryMongo = PrismaInventoryCategory;
export type InventorySubcategoryMongo = PrismaInventorySubcategory;
export type InventoryMetaFieldMongo = PrismaInventoryMetaField;
export type StockMovementMongo = PrismaInventoryStockMovement;

export type InventoryItemDocument = PrismaInventoryItem & {
  _id: string;
};
export type InventoryBatchDocument = PrismaInventoryBatch & {
  _id: string;
};
export type InventoryVendorDocument = PrismaInventoryVendor & {
  _id: string;
};
export type InventoryMetaFieldDocument = PrismaInventoryMetaField & {
  _id: string;
};

export const InventoryItemModel: any = {};
export const InventoryBatchModel: any = {};
export const InventoryVendorModel: any = {};
export const InventoryCategoryModel: any = {};
export const InventorySubcategoryModel: any = {};
export const InventoryMetaFieldModel: any = {};
export const StockMovementModel: any = {};
