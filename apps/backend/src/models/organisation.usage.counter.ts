import mongoose from "mongoose";

const { Schema } = mongoose;

const OrgUsageCountersSchema = new Schema(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Org",
      required: true,
      unique: true,
      index: true,
    },
    appointmentsUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    toolsUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    usersActiveCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    usersBillableCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    freeAppointmentsLimit: {
      type: Number,
      default: 120,
      min: 0,
    },

    freeToolsLimit: {
      type: Number,
      default: 200,
      min: 0,
    },
    freeUsersLimit: {
      type: Number,
      default: 10,
      min: 0,
    },
    freeLimitReachedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

OrgUsageCountersSchema.index({ freeLimitReachedAt: 1 });

export const OrgUsageCounters = mongoose.model(
  "OrgUsageCounters",
  OrgUsageCountersSchema,
);
