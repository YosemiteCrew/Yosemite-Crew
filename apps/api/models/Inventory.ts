import { Schema, model } from 'mongoose';
import type { InventoryType, ProcedurePackageType } from '@yosemite-crew/types';

const InventorySchema = new Schema<InventoryType>(
  {
    bussinessId: String,
    barCode: String,
    category: String,
    itemName: String,
    genericName: String,
    department: String,
    sexType: String,
    manufacturer: String,
    itemCategory: String,
    speciesSpecific1: String,
    speciesSpecific2: String,
    onHand: String,
    perQtyPrice: Number,
    batchNumber: String,
    sku: String,
    strength: String,
    quantity: Number,
    manufacturerPrice: Number,
    markup: Number,
    upc: String,
    price: Number,
    stockReorderLevel: Number,
    expiryDate: Date,
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