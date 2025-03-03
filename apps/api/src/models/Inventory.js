const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    bussinessId: { type: String, required: true },
    category: { type: String, required: true }, // Select Category
    barcode: { type: String, unique: true }, // Bar Code
    itemName: { type: String, required: true }, // Item Name
    genericName: { type: String }, // Generic Name
    manufacturer: { type: String, required: true }, // Manufacturer
    itemCategory: { type: String, required: true }, // Item Category (Tablet, Syrup, etc.)
    batchNumber: { type: String, unique: true }, // Batch Number
    sku: { type: String, unique: true }, // SKU
    strength: { type: String }, // Strength (e.g., 500mg)
    quantity: { type: Number, required: true, min: 0 }, // Quantity
    manufacturerPrice: { type: Number, required: true }, // Manufacturer Price
    markup: { type: Number, required: true }, // % Markup
    price: { type: Number, required: true }, // Final Price
    stockReorderLevel: { type: Number, required: true }, // Stock Reorder Level
    expiryDate: { type: String, required: true }, // Expiry Date
  },
  { timestamps: true }
);
Inventory = mongoose.model('Inventory', inventorySchema);

const ProcedurePackageSchema = new mongoose.Schema(
  {
    bussinessId: { type: String, required: true },
    packageName: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String },
    packageItems: [
      {
        name: { type: String, required: true },
        itemType: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        subtotal: { type: Number, required: true, min: 0 },
        notes: { type: String },
      },
    ],
  },
  { timestamps: true }
);

const ProcedurePackage = mongoose.model(
  'ProcedurePackage',
  ProcedurePackageSchema
);

module.exports = { Inventory, ProcedurePackage };
