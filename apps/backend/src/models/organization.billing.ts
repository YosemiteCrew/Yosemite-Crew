import mongoose from "mongoose";

const { Schema } = mongoose;

const OrgBillingSchema = new Schema(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Org",
      required: true,
      unique: true,
      index: true,
    },

    connectAccountId: {
      type: String,
      default: null,
      index: true, // acct_...
    },

    canAcceptPayments: {
      type: Boolean,
      default: false,
      index: true,
    },

    connectChargesEnabled: { type: Boolean, default: false },
    connectPayoutsEnabled: { type: Boolean, default: false },

    connectDisabledReason: { type: String, default: null },

    connectRequirements: {
      currentlyDue: { type: [String], default: [] },
      eventuallyDue: { type: [String], default: [] },
      pastDue: { type: [String], default: [] },
      pendingVerification: { type: [String], default: [] },
      errors: { type: [Schema.Types.Mixed], default: [] },
    },
    stripeCustomerId: {
      type: String,
      default: null,
      index: true, // cus_...
    },
    stripeSubscriptionId: {
      type: String,
      default: null,
      index: true, // sub_...
    },
    stripeSubscriptionItemId: {
      type: String,
      default: null, // si_...
    },
    stripePriceId: {
      type: String,
      default: null, // price_...
    },
    stripeProductId: {
      type: String,
      default: null, // prod_...
    },
    stripeLivemode: {
      type: Boolean,
      default: false,
    },
    plan: {
      type: String,
      enum: ["free", "business"],
      default: "free",
      index: true,
    },
    billingInterval: {
      type: String,
      enum: ["month", "year"],
      default: undefined, // only set for business plan
    },
    currency: {
      type: String,
      default: "usd",
    },
    seatQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    seatQuantityUpdatedAt: {
      type: Date,
      default: null,
    },
    subscriptionStatus: {
      type: String,
      enum: [
        "none",
        "trialing",
        "active",
        "past_due",
        "unpaid",
        "canceled",
        "incomplete",
        "incomplete_expired",
        "paused",
      ],
      default: "none",
      index: true,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    canceledAt: {
      type: Date,
      default: null,
    },
    currentPeriodStart: {
      type: Date,
      default: null,
    },
    currentPeriodEnd: {
      type: Date,
      default: null, // next due date for prepaid subs
    },
    nextInvoiceAt: {
      type: Date,
      default: null,
    },
    lastInvoiceId: {
      type: String,
      default: null, // in_...
    },
    lastPaymentStatus: {
      type: String,
      default: null, // paid | failed | open
    },
    lastPaymentAt: {
      type: Date,
      default: null,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    upgradedAt: {
      type: Date,
      default: null,
    },
    downgradedAt: {
      type: Date,
      default: null,
    },
    accessState: {
      type: String,
      enum: ["free", "active", "past_due", "suspended"],
      default: "free",
      index: true,
    },
    gracePeriodEndsAt: {
      type: Date,
      default: null,
    },
    version: {
      type: Number,
      default: 0,
    },
    lastStripeEventId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

OrgBillingSchema.index({ stripeCustomerId: 1, stripeSubscriptionId: 1 });
OrgBillingSchema.index({ orgId: 1, plan: 1 });

export const OrgBilling = mongoose.model("OrgBilling", OrgBillingSchema);
