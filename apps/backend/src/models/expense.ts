import { Schema, model, HydratedDocument } from "mongoose";

export interface ExternalExpenseAttachment {
  key: string;
  mimeType: string;
  size?: number;
}

export interface ExternalExpenseMongo {
  companionId: string;
  parentId: string;

  category: string;
  subcategory?: string;
  visitType?: string;

  expenseName: string;

  businessName?: string | null;

  date: Date;
  amount: number;
  currency: string;

  attachments?: ExternalExpenseAttachment[];
  notes?: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}

const AttachmentSchema = new Schema<ExternalExpenseAttachment>(
  {
    key: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number },
  },
  { _id: false },
);

const ExternalExpenseSchema = new Schema<ExternalExpenseMongo>(
  {
    companionId: { type: String, required: true, index: true },
    parentId: { type: String, required: true, index: true },

    category: { type: String, required: true },
    subcategory: { type: String },
    visitType: { type: String },

    expenseName: { type: String, required: true },

    businessName: { type: String },

    date: { type: Date, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "USD" },

    attachments: { type: [AttachmentSchema], default: [] },

    notes: { type: String },
  },
  { timestamps: true },
);

export type ExternalExpenseDocument = HydratedDocument<ExternalExpenseMongo>;

export const ExternalExpenseModel = model<ExternalExpenseMongo>(
  "ExternalExpense",
  ExternalExpenseSchema,
);

export default ExternalExpenseModel;
