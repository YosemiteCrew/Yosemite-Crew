import { Schema, model, HydratedDocument } from "mongoose";

export type BusinessType =
  | "HOSPITAL"
  | "GROOMING"
  | "BREEDING"
  | "BOARDING"
  | "GENERAL";

// Invetory Item

export interface InventoryItemMongo {
  organisationId: string;

  businessType: BusinessType;

  name: string;
  sku?: string;

  category: string;       // Medicine / Consumable / Bedding / Accessory...
  subCategory?: string;

  description?: string;
  imageUrl?: string;

  attributes: Record<string, unknown>;  // dynamic fields per business type

  onHand: number;
  allocated: number;
  reorderLevel?: number;

  unitCost?: number;
  sellingPrice?: number;
  currency?: string;

  vendorId?: string;      // references InventoryVendor

  status: "ACTIVE" | "HIDDEN" | "DELETED";

  createdAt?: Date;
  updatedAt?: Date;
}

const InventoryItemSchema = new Schema<InventoryItemMongo>(
  {
    organisationId: { type: String, required: true },

    businessType: {
      type: String,
      enum: ["HOSPITAL", "GROOMING", "BREEDING", "BOARDING", "GENERAL"],
      required: true,
    },

    name: { type: String, required: true },
    sku: String,

    category: { type: String, required: true },
    subCategory: String,

    description: String,
    imageUrl: String,

    attributes: { type: Schema.Types.Mixed, default: {} },

    onHand: { type: Number, default: 0 },
    allocated: { type: Number, default: 0 },
    reorderLevel: Number,

    unitCost: Number,
    sellingPrice: Number,
    currency: String,

    vendorId: { type: String },

    status: {
      type: String,
      enum: ["ACTIVE", "HIDDEN", "DELETED"],
      default: "ACTIVE",
    },
  },
  { timestamps: true }
);

InventoryItemSchema.index({ organisationId: 1, name: 1 });
InventoryItemSchema.index({ category: 1, subCategory: 1 });
InventoryItemSchema.index({ businessType: 1 });
InventoryItemSchema.index({ status: 1 });

export type InventoryItemDocument = HydratedDocument<InventoryItemMongo>;
export const InventoryItemModel = model<InventoryItemMongo>("InventoryItem", InventoryItemSchema);

// Invetory Batch

export interface InventoryBatchMongo {
  itemId: string;  // InventoryItem reference
  organisationId : string;
  batchNumber?: string;
  lotNumber?: string;
  regulatoryTrackingId?: string;

  manufactureDate?: Date;
  expiryDate?: Date;

  minShelfLifeAlertDate?: Date;

  quantity: number; // batch-specific quantity
  allocated: number;

  createdAt?: Date;
  updatedAt?: Date;
}

const InventoryBatchSchema = new Schema<InventoryBatchMongo>(
  {
    itemId: { type: String, required: true, index: true },
    organisationId: { type: String, required: true, index: true },
    batchNumber: String,
    lotNumber: String,
    regulatoryTrackingId: String,

    manufactureDate: Date,
    expiryDate: Date,
    minShelfLifeAlertDate: Date,

    quantity: { type: Number, default: 0 },
    allocated: { type: Number, default: 0 },
  },
  { timestamps: true }
);

InventoryBatchSchema.index({ expiryDate: 1 });
InventoryBatchSchema.index({ minShelfLifeAlertDate: 1 });

export type InventoryBatchDocument = HydratedDocument<InventoryBatchMongo>;
export const InventoryBatchModel = model<InventoryBatchMongo>("InventoryBatch", InventoryBatchSchema);

// Invetory Vendor

export interface InventoryVendorMongo {
  organisationId: string;

  name: string;
  brand?: string;
  vendorType?: string; // Distributor / Manufacturer / Retailer / Wholesaler
  licenseNumber?: string;

  paymentTerms?: string; // Net 30 / COD / etc.
  deliveryFrequency?: string; // Weekly / Monthly / On demand
  leadTimeDays?: number;

  contactInfo?: {
    phone?: string;
    email?: string;
    address?: string;
  };

  createdAt?: Date;
  updatedAt?: Date;
}

const VendorSchema = new Schema<InventoryVendorMongo>(
  {
    organisationId: { type: String, required: true },
    name: { type: String, required: true },

    brand: String,
    vendorType: String,
    licenseNumber: String,

    paymentTerms: String,
    deliveryFrequency: String,
    leadTimeDays: Number,

    contactInfo: {
      phone: String,
      email: String,
      address: String,
    },
  },
  { timestamps: true }
);

VendorSchema.index({ organisationId: 1, name: 1 });

export type InventoryVendorDocument = HydratedDocument<InventoryVendorMongo>;
export const InventoryVendorModel = model<InventoryVendorMongo>("InventoryVendor", VendorSchema);


// Inventory Meta field

export interface InventoryMetaFieldMongo {
  businessType: string;  // HOSPITAL / GROOMING / BREEDING / BOARDING
  fieldKey: string;      // "therapeuticClass", "coatType", "unitOfMeasure"
  label: string;         // user-friendly label

  values: string[];      // dropdown options

  createdAt?: Date;
  updatedAt?: Date;
}

const MetaFieldSchema = new Schema<InventoryMetaFieldMongo>(
  {
    businessType: { type: String, required: true },
    fieldKey: { type: String, required: true },
    label: { type: String, required: true },
    values: { type: [String], required: true },
  },
  { timestamps: true }
);

MetaFieldSchema.index({ businessType: 1, fieldKey: 1 }, { unique: true });

export type InventoryMetaFieldDocument =
  HydratedDocument<InventoryMetaFieldMongo>;

export const InventoryMetaFieldModel = model<InventoryMetaFieldMongo>(
  "InventoryMetaField",
  MetaFieldSchema
);

// Stock movement

export interface StockMovementMongo {
  itemId: string;
  batchId?: string;
  change: number;
  reason: string;
  referenceId?: string;
  userId?: string;
  createdAt: Date;
}

const StockMovementSchema = new Schema<StockMovementMongo>(
  {
    itemId: String,
    batchId: String,
    change: Number,
    reason: String,
    referenceId: String,
    userId: String,
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const StockMovementModel = model<StockMovementMongo>(
  "InventoryStockMovement",
  StockMovementSchema
);
