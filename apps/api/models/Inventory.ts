import { Schema, model } from 'mongoose';
import type { InventoryType,ProcedurePackageType } from '@yosemite-crew/types';

const InventorySchema = new Schema<InventoryType>(
  {
    bussinessId: { type: String, required: true }, // keep this as it's essential

    itemName: { type: String, required: true },      // Name
    genericName: { type: String },                   // Generic Name
    category: { type: String, required: true },      // Stock Category
    sku: { type: String, unique: true },             // SKU

    dosageAdministration: { type: String },          // Dosage Administration
    itemCategory: { type: String },                  // If falls in pet Type Category

    manufacturer: { type: String, required: true },  // Manufacturer
    manufacturerPrice: { type: Number },             // Manufacturer Price
    price: { type: Number, required: true },         // Price
    quantity: { type: Number, required: true },      // Stock

    manufacturingDate: { type: String },             // Manufacturing Date
    expiryDate: { type: String, required: true },    // Expiry Date
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