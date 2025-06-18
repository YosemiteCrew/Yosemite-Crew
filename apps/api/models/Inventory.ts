import { Schema, model } from 'mongoose';
import type { InventoryType,ProcedurePackageType } from '@yosemite-crew/types';

const InventorySchema = new Schema<InventoryType>(
  {
    bussinessId: { type: String, required: true },
    category: { type: String, required: true },
    barcode: { type: String, unique: true },
    itemName: { type: String, required: true },
    genericName: String,
    manufacturer: { type: String, required: true },
    itemCategory: { type: String, required: true },
    batchNumber: { type: String, unique: true },
    sku: { type: String, unique: true },
    strength: String,
    quantity: { type: Number, required: true },
    manufacturerPrice: { type: Number, required: true },
    markup: { type: Number, required: true },
    price: { type: Number, required: true },
    stockReorderLevel: { type: Number, required: true },
    expiryDate: { type: String, required: true },
  },
  { timestamps: true }
);

export const Inventory = model<InventoryType>('Inventory', InventorySchema);

const ProcedurePackageSchema = new Schema<ProcedurePackageType>(
  {
    bussinessId: { type: String, required: true },
    packageName: { type: String, required: true },
    category: { type: String, required: true },
    description: String,
    packageItems: [
      {
        name: { type: String, required: true },
        itemType: { type: String, required: true },
        quantity: { type: Number, required: true },
        unitPrice: { type: Number, required: true },
        subtotal: { type: Number, required: true },
        notes: String,
      },
    ],
  },
  { timestamps: true }
);

export const ProcedurePackage = model<ProcedurePackageType>('ProcedurePackage', ProcedurePackageSchema);