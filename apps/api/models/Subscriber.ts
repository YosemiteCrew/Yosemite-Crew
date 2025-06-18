import mongoose, { Schema, Model } from "mongoose";
import type { ISubscriber } from "@yosemite-crew/types";

const SubscriberSchema: Schema<ISubscriber> = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      match: /.+\@.+\..+/,
    },
    subscribed: {
      type: Boolean,
      default: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "YoshUser",
    },
    countryCode: {
      type: String,
      required: true,
    },
    userType: {
      type: String,
      enum: ["Pet Owner", "Business", "Developer"],
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const Subscriber: Model<ISubscriber> = mongoose.model<ISubscriber>(
  "Subscriber",
  SubscriberSchema
);

export default Subscriber;
