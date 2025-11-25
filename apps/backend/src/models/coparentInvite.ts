import { Schema, model, Types, HydratedDocument } from "mongoose";

export interface CoParentInviteMongo {
  email: string; // email of invited co-parent
  inviteeName: string; // name of invited co-parent
  companionId: Types.ObjectId; // which pet the invite is for
  invitedByParentId: Types.ObjectId; // primary parent
  inviteToken: string; // random token
  expiresAt: Date; // expiry timestamp
  acceptedAt?: Date; // when user accepted
  diclinedAt?: Date; // when user declined
  consumed?: boolean; // to prevent re-use
}

const CoParentInviteSchema = new Schema<CoParentInviteMongo>(
  {
    email: { type: String, required: true, index: true },
    inviteeName: { type: String },
    companionId: {
      type: Schema.Types.ObjectId,
      ref: "Companion",
      required: true,
    },
    invitedByParentId: {
      type: Schema.Types.ObjectId,
      ref: "Parent",
      required: true,
    },
    inviteToken: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date },
    diclinedAt: { type: Date },
    consumed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type CoParentInviteDocument = HydratedDocument<CoParentInviteMongo>;

export const CoParentInviteModel = model<CoParentInviteMongo>(
  "CoParentInvite",
  CoParentInviteSchema,
);
