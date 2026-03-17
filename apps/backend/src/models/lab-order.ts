import { Schema, model, type HydratedDocument, Types } from "mongoose";

export type LabOrderStatus =
  | "CREATED"
  | "SUBMITTED"
  | "AT_THE_LAB"
  | "PARTIAL"
  | "RUNNING"
  | "COMPLETE"
  | "CANCELLED"
  | "ERROR";

export type LabOrderModality = "IN_HOUSE" | "REFERENCE_LAB";

export interface LabOrderMongo {
  organisationId: string;
  provider: string;
  companionId: Types.ObjectId;
  parentId: Types.ObjectId;
  appointmentId?: Types.ObjectId | null;
  createdByUserId?: string | null;
  status: LabOrderStatus;
  modality?: LabOrderModality | null;
  idexxOrderId?: string | null;
  uiUrl?: string | null;
  pdfUrl?: string | null;
  tests: string[];
  veterinarian?: string | null;
  technician?: string | null;
  notes?: string | null;
  specimenCollectionDate?: string | null;
  ivls?: Array<{ serialNumber: string }> | null;
  requestPayload?: Record<string, unknown> | null;
  responsePayload?: Record<string, unknown> | null;
  error?: string | null;
  externalStatus?: string | null;
  invoiceId?: string | null;
  billedAt?: Date | null;
  billingError?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const LabOrderSchema = new Schema<LabOrderMongo>(
  {
    organisationId: { type: String, required: true, index: true },
    provider: { type: String, required: true, index: true },
    companionId: { type: Schema.Types.ObjectId, required: true, index: true },
    parentId: { type: Schema.Types.ObjectId, required: true, index: true },
    appointmentId: { type: Schema.Types.ObjectId, default: null, index: true },
    createdByUserId: { type: String, default: null },
    status: {
      type: String,
      required: true,
      enum: [
        "CREATED",
        "SUBMITTED",
        "AT_THE_LAB",
        "PARTIAL",
        "RUNNING",
        "COMPLETE",
        "CANCELLED",
        "ERROR",
      ],
      default: "CREATED",
    },
    modality: {
      type: String,
      enum: ["IN_HOUSE", "REFERENCE_LAB"],
      default: "REFERENCE_LAB",
    },
    idexxOrderId: { type: String, default: null, index: true },
    uiUrl: { type: String, default: null },
    pdfUrl: { type: String, default: null },
    tests: { type: [String], required: true, default: [] },
    veterinarian: { type: String, default: null },
    technician: { type: String, default: null },
    notes: { type: String, default: null },
    specimenCollectionDate: { type: String, default: null },
    ivls: { type: [Schema.Types.Mixed], default: null },
    requestPayload: { type: Schema.Types.Mixed, default: null },
    responsePayload: { type: Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
    externalStatus: { type: String, default: null },
    invoiceId: { type: String, default: null, index: true },
    billedAt: { type: Date, default: null },
    billingError: { type: String, default: null },
  },
  { timestamps: true, collection: "lab_orders" },
);

LabOrderSchema.index({ organisationId: 1, provider: 1, createdAt: -1 });
LabOrderSchema.index({ invoiceId: 1 });

export type LabOrderDocument = HydratedDocument<LabOrderMongo>;

export default model<LabOrderMongo>("LabOrder", LabOrderSchema);
