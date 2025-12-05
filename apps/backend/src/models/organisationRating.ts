import { Schema, model } from "mongoose";

const OrgRatingSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "Parent",
      required: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    review: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

// Prevent duplicate reviews (same user/org)
OrgRatingSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

export const OrganisationRatingModel = model(
  "OrganisationRating",
  OrgRatingSchema,
);
