import { Schema, model, HydratedDocument } from "mongoose";

export type InvoiceStatusMongo =
  | "PENDING"
  | "AWAITING_PAYMENT"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED";

export type InvoiceItemMongo = {
  id?: string;
  name: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  discountPercent?: number | null;
  total: number;
};

const InvoiceItemSchema = new Schema(
  {
    id: { type: String },
    name: { type: String, required: true },
    description: { type: String, default: null },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    discountPercent: { type: Number, default: null },
    total: { type: Number, required: true },
  },
  { _id: false },
);

export interface InvoiceMongo {
  parentId?: string;
  companionId?: string;
  organisationId?: string;
  appointmentId?: string;

  items: InvoiceItemMongo[];

  subtotal: number;
  taxPercent?: number;
  totalAmount: number;

  currency: string; // FHIR Currency type = code ("USD", "INR", etc.)

  stripePaymentIntentId?: string;
  stripePaymentLinkId?: string;
  stripeInvoiceId?: string;
  stripeCustomerId?: string;

  status: InvoiceStatusMongo;

  metadata?: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<InvoiceMongo>(
  {
    parentId: { type: String },
    companionId: { type: String },
    organisationId: { type: String },
    appointmentId: { type: String },

    items: {
      type: [InvoiceItemSchema],
      required: true,
      validate: {
        validator: (items: InvoiceItemMongo[]) => items.length > 0,
        message: "Invoice must have at least one item",
      },
    },

    subtotal: { type: Number, required: true },
    taxPercent: { type: Number, default: null },
    totalAmount: { type: Number, required: true },

    currency: { type: String, required: true },

    stripePaymentIntentId: { type: String, default: null },
    stripePaymentLinkId: { type: String, default: null },
    stripeInvoiceId: { type: String, default: null },
    stripeCustomerId: { type: String, default: null },

    status: {
      type: String,
      enum: [
        "PENDING",
        "AWAITING_PAYMENT",
        "PAID",
        "FAILED",
        "CANCELLED",
        "REFUNDED",
      ],
      default: "PENDING",
    },

    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

// Useful indexes
InvoiceSchema.index({ parentId: 1 });
InvoiceSchema.index({ organisationId: 1 });
InvoiceSchema.index({ appointmentId: 1 });
InvoiceSchema.index({ stripePaymentIntentId: 1 });
InvoiceSchema.index({ status: 1 });

export type InvoiceDocument = HydratedDocument<InvoiceMongo>;
export const InvoiceModel = model<InvoiceMongo>("Invoice", InvoiceSchema);
export default InvoiceModel;
