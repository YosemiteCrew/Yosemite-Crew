import { Schema, model, Types, HydratedDocument } from "mongoose";

export interface DocumentAttachment {
  key: string;          // S3 key for download
  mimeType: string;     // application/pdf, image/jpeg, etc.
  size?: number;        // Optional file size in bytes
}

export interface DocumentMongo {
  companionId: Types.ObjectId; 
  appointmentId?: Types.ObjectId | null;
  //calssifications
  category: string;
  subcategory?: string | null;
  visitType?: string | null;
  title: string;
  issuingBusinessName?: string | null;
  issueDate?: Date | null;
  // S3 attachments
  attachments: DocumentAttachment[];
  uploadedByParentId?: Types.ObjectId | null;
  uploadedByPmsUserId?: string;
  pmsVisible: boolean; 
  syncedFromPms: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type DocumentDocument = HydratedDocument<DocumentMongo>;

const AttachmentSchema = new Schema<DocumentAttachment>(
  {
    key: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number },
  },
  { _id: false }
);

const DocumentSchema = new Schema<DocumentMongo>(
  {
    companionId: {
      type: Schema.Types.ObjectId,
      ref: "Companion",
      required: true,
      index: true,
    },

    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
    },

    category: { type: String, required: true },
    subcategory: { type: String, default: null },

    visitType: { type: String, default: null },
    title: { type: String, required: true },
    issuingBusinessName: { type: String, default: null },

    issueDate: { type: Date, default: null },

    attachments: {
      type: [AttachmentSchema],
      required: true,
      validate: (val: DocumentAttachment[]) =>
        Array.isArray(val) && val.length > 0,
    },

    uploadedByParentId: {
      type: Schema.Types.ObjectId,
      ref: "Parent",
      default: null,
    },

    uploadedByPmsUserId: {
      type: String,
      ref: "User",
      default: null,
    },

    pmsVisible: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },

    syncedFromPms: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

DocumentSchema.index({ companionId: 1, category: 1 });
DocumentSchema.index({ companionId: 1, pmsVisible: 1 });
DocumentSchema.index({ appointmentId: 1 });

export default model<DocumentMongo>("Document", DocumentSchema);