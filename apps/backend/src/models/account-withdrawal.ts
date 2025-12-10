import { Schema, model, HydratedDocument } from "mongoose";

export type WithdrawalStatus =
  | "RECEIVED"
  | "IN_REVIEW"
  | "COMPLETED"
  | "REJECTED";

export interface AccountWithdrawalMongo {
  userId?: string; // optional: current logged in user
  fullName: string;
  email: string;
  address?: string;
  signatureText?: string; // the text user typed
  message?: string; // “I/we hereby withdraw …” + free text if you want
  checkboxConfirmed: boolean;

  status: WithdrawalStatus;

  createdAt?: Date;
  updatedAt?: Date;
  processedAt?: Date | null;
  processedByUserId?: string | null; // admin who handled it
}

const AccountWithdrawalSchema = new Schema<AccountWithdrawalMongo>(
  {
    userId: { type: String },
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String },
    signatureText: { type: String },
    message: { type: String },
    checkboxConfirmed: { type: Boolean, required: true },

    status: {
      type: String,
      enum: ["RECEIVED", "IN_REVIEW", "COMPLETED", "REJECTED"],
      default: "RECEIVED",
    },

    processedAt: { type: Date, default: null },
    processedByUserId: { type: String, default: null },
  },
  { timestamps: true },
);

export type AccountWithdrawalDocument =
  HydratedDocument<AccountWithdrawalMongo>;

export const AccountWithdrawalModel = model<AccountWithdrawalMongo>(
  "AccountWithdrawal",
  AccountWithdrawalSchema,
);
